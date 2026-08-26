import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { aggregateSupabaseUsage, supabaseProjectHealthy, type SupabaseUsagePoint } from './supabase-metrics';

type Credentials = { accessToken: string; projectRef: string };
type Project = { id?: string; ref?: string; name?: string; region?: string; status?: string };
type UsageResponse = { result?: SupabaseUsagePoint[]; error?: string | null };

const origin = 'https://api.supabase.com';

async function apiGet<T>(credentials: Credentials, path: string) {
  const response = await fetch(`${origin}${path}`, { headers: { accept: 'application/json', authorization: `Bearer ${credentials.accessToken}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}. Check the project ref and token permissions.`);
  return response.json() as Promise<T>;
}

async function readUsage(credentials: Credentials) {
  const response = await apiGet<UsageResponse>(credentials, `/v1/projects/${credentials.projectRef}/analytics/endpoints/usage.api-counts?interval=1day`);
  if (response.error) throw new Error(`Supabase usage API failed: ${response.error}`);
  return response.result || [];
}

export async function validateSupabaseCredentials(accessToken: string, projectRef: string) {
  const normalizedRef = projectRef.trim().toLowerCase();
  if (!/^[a-z]{20}$/.test(normalizedRef)) throw new Error('Supabase project ref must contain exactly 20 lowercase letters.');
  const credentials = { accessToken, projectRef: normalizedRef };
  const [project, usage] = await Promise.all([apiGet<Project>(credentials, `/v1/projects/${normalizedRef}`), readUsage(credentials)]);
  if ((project.ref || project.id) !== normalizedRef) throw new Error('Supabase returned a different project than the requested ref.');
  return { projectRef: normalizedRef, projectName: project.name || normalizedRef, region: project.region || null, status: project.status || 'UNKNOWN', usagePoints: usage.length };
}

export async function syncSupabaseWorkspace(workspaceId: string) {
  const db = getDb();
  const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'supabase'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected Supabase project mappings were found.');
  let written = 0; const summaries: Array<{ connectorId: string; records: number; projectRef: string; status: string }> = [];
  for (const item of mappings) {
    const runId = crypto.randomUUID(); await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'supabase', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!item.connector.encryptedCredentials) throw new Error('Supabase credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as Credentials;
      const [project, usage] = await Promise.all([apiGet<Project>(credentials, `/v1/projects/${credentials.projectRef}`), readUsage(credentials)]);
      const collectedAt = new Date().toISOString(); const dimensionsJson = JSON.stringify({ projectRef: credentials.projectRef });
      const points = aggregateSupabaseUsage(usage).flatMap((value) => [
        { workspaceId, productId: item.mapping.productId, source: 'supabase', metric: 'supabase_api_requests', metricDate: value.metricDate, value: value.apiRequests, dimensionsJson, collectedAt },
        { workspaceId, productId: item.mapping.productId, source: 'supabase', metric: 'supabase_auth_requests', metricDate: value.metricDate, value: value.authRequests, dimensionsJson, collectedAt },
        { workspaceId, productId: item.mapping.productId, source: 'supabase', metric: 'supabase_realtime_requests', metricDate: value.metricDate, value: value.realtimeRequests, dimensionsJson, collectedAt },
        { workspaceId, productId: item.mapping.productId, source: 'supabase', metric: 'supabase_rest_requests', metricDate: value.metricDate, value: value.restRequests, dimensionsJson, collectedAt },
        { workspaceId, productId: item.mapping.productId, source: 'supabase', metric: 'supabase_storage_requests', metricDate: value.metricDate, value: value.storageRequests, dimensionsJson, collectedAt },
      ]);
      points.push({ workspaceId, productId: item.mapping.productId, source: 'supabase', metric: 'supabase_project_healthy', metricDate: collectedAt.slice(0, 10), value: supabaseProjectHealthy(project.status), dimensionsJson, collectedAt });
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; summaries.push({ connectorId: item.connector.id, records: points.length, projectRef: credentials.projectRef, status: project.status || 'UNKNOWN' }); await db.update(syncRuns).set({ status: 'success', recordsWritten: points.length, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : 'Supabase synchronization failed.'; await db.update(syncRuns).set({ status: 'error', errorCode: 'SUPABASE_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId))); throw error; }
  }
  return { written, connectors: summaries };
}
