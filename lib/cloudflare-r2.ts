import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { normalizeR2Day, type R2OperationRow, type R2StorageRow } from './cloudflare-r2-metrics';

type Credentials = { accountId: string; apiToken: string };
type AccountResult = Record<string, R2OperationRow[] | R2StorageRow[]>;

function day(offset: number) { return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10); }

function queryForDays(days: number) {
  const declarations = ['$accountTag: string!', '$bucket: string!']; const selections: string[] = [];
  for (let index = 0; index < days; index += 1) {
    declarations.push(`$s${index}: Time!`, `$e${index}: Time!`);
    selections.push(`o${index}: r2OperationsAdaptiveGroups(limit:10,filter:{datetime_geq:$s${index},datetime_leq:$e${index},bucketName:$bucket}) { sum { requests } dimensions { actionStatus } }`);
    selections.push(`b${index}: r2StorageAdaptiveGroups(limit:1,filter:{datetime_geq:$s${index},datetime_leq:$e${index},bucketName:$bucket},orderBy:[datetime_DESC]) { max { objectCount uploadCount payloadSize metadataSize } }`);
  }
  return `query R2Daily(${declarations.join(',')}) { viewer { accounts(filter:{accountTag:$accountTag}) { ${selections.join('\n')} } } }`;
}

async function fetchR2(credentials: Credentials, bucketName: string, days = 31) {
  const variables: Record<string, string> = { accountTag: credentials.accountId, bucket: bucketName };
  for (let index = 0; index < days; index += 1) { const metricDate = day(index - (days - 1)); variables[`s${index}`] = `${metricDate}T00:00:00Z`; variables[`e${index}`] = `${metricDate}T23:59:59Z`; }
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { authorization: `Bearer ${credentials.apiToken}`, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query: queryForDays(days), variables }), signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Cloudflare R2 GraphQL returned HTTP ${response.status}.`);
  const payload = await response.json() as { data?: { viewer?: { accounts?: AccountResult[] } }; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) throw new Error(payload.errors[0].message || 'Cloudflare R2 GraphQL returned an error.');
  return payload.data?.viewer?.accounts?.[0] || {};
}

export async function validateR2Access(credentials: Credentials, bucketName: string) {
  if (!/^[a-z0-9][a-z0-9._-]{0,178}[a-z0-9]$/.test(bucketName) && !/^[a-z0-9]$/.test(bucketName)) throw new Error('Enter the R2 analytics bucket name, including a jurisdiction prefix when applicable.');
  await fetchR2(credentials, bucketName, 1);
}

export async function syncCloudflareR2Workspace(workspaceId: string) {
  const db = getDb(); const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'cloudflare_r2'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected Cloudflare R2 bucket mappings were found.');
  let written = 0; const summaries: Array<{ connectorId: string; bucketName: string; records: number }> = [];
  for (const item of mappings) {
    const runId = crypto.randomUUID(); await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'cloudflare_r2', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!item.connector.encryptedCredentials) throw new Error('Cloudflare credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as Credentials; const result = await fetchR2(credentials, item.mapping.resourceId); const collectedAt = new Date().toISOString(); const dimensionsJson = JSON.stringify({ bucketName: item.mapping.resourceId, truncated: true, truncationReason: 'cloudflare_r2_retention_31_days' }); const points = [];
      for (let index = 0; index < 31; index += 1) { const metricDate = day(index - 30); const storageRows = (result[`b${index}`] as R2StorageRow[]) || []; const value = normalizeR2Day((result[`o${index}`] as R2OperationRow[]) || [], storageRows); points.push(
        { workspaceId, productId: item.mapping.productId, source: 'cloudflare_r2', metric: 'r2_requests', metricDate, value: value.requests, dimensionsJson, collectedAt },
        { workspaceId, productId: item.mapping.productId, source: 'cloudflare_r2', metric: 'r2_errors', metricDate, value: value.errors, dimensionsJson, collectedAt },
      ); if (storageRows.length) points.push(
          { workspaceId, productId: item.mapping.productId, source: 'cloudflare_r2', metric: 'r2_payload_bytes', metricDate, value: value.payloadBytes, dimensionsJson, collectedAt },
          { workspaceId, productId: item.mapping.productId, source: 'cloudflare_r2', metric: 'r2_metadata_bytes', metricDate, value: value.metadataBytes, dimensionsJson, collectedAt },
          { workspaceId, productId: item.mapping.productId, source: 'cloudflare_r2', metric: 'r2_objects', metricDate, value: value.objects, dimensionsJson, collectedAt },
          { workspaceId, productId: item.mapping.productId, source: 'cloudflare_r2', metric: 'r2_pending_uploads', metricDate, value: value.pendingUploads, dimensionsJson, collectedAt },
        ); }
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; summaries.push({ connectorId: item.connector.id, bucketName: item.mapping.resourceId, records: points.length }); await db.update(syncRuns).set({ status: 'partial', recordsWritten: points.length, errorMessage: 'Cloudflare R2 Analytics retains only the latest 31 days; longer comparison coverage is unavailable.', finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : 'Cloudflare R2 sync failed.'; await db.update(syncRuns).set({ status: 'error', errorCode: 'CLOUDFLARE_R2_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId))); throw error; }
  }
  return { written, connectors: summaries, coverageDays: 31, partial: true };
}
