import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { fetchCustomRestMetrics } from './custom-rest-client';
import type { CustomRestConfiguration } from './custom-rest-contract';

export async function syncCustomRestWorkspace(workspaceId: string) {
  const db = getDb();
  const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'custom'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected Custom REST mappings were found.');
  let written = 0; const summaries: Array<{ connectorId: string; records: number; truncated: boolean }> = [];
  for (const item of mappings) {
    const runId = crypto.randomUUID(); await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'custom', status: 'running', startedAt: new Date().toISOString() });
    try {
      const configuration = JSON.parse(item.mapping.configurationJson) as CustomRestConfiguration;
      const credentials = item.connector.encryptedCredentials ? JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as { secret?: string } : {};
      const payload = await fetchCustomRestMetrics(configuration, credentials.secret); const collectedAt = new Date().toISOString();
      const points = payload.metrics.map((row) => { const values = { ...row.dimensions, ...(row.unit ? { unit: row.unit } : {}), ...(row.domain ? { domain: row.domain } : {}), ...(payload.truncated ? { truncated: true } : {}), connector: item.connector.externalAccountId || item.connector.id }; const stableDimensions = Object.fromEntries(Object.entries(values).sort(([left], [right]) => left.localeCompare(right))); return { workspaceId, productId: item.mapping.productId, source: 'custom', metric: row.metric, metricDate: row.date, value: row.value, dimensionsJson: JSON.stringify(stableDimensions), collectedAt }; });
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; summaries.push({ connectorId: item.connector.id, records: points.length, truncated: payload.truncated }); await db.update(syncRuns).set({ status: 'success', recordsWritten: points.length, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: collectedAt, updatedAt: collectedAt }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Custom REST synchronization failed.'; await db.update(syncRuns).set({ status: 'error', errorCode: 'CUSTOM_REST_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId))); throw error;
    }
  }
  return { written, connectors: summaries };
}
