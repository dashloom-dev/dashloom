import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from '@/lib/crypto';
import { normalizeQueueMetrics, type QueueRealtimeMetrics } from '@/lib/cloudflare-queues-metrics';

type Credentials = { accountId: string; apiToken: string };
type Queue = { queue_id?: string; queue_name?: string; settings?: { delivery_paused?: boolean } };
type CloudflareResponse<T> = { success?: boolean; result?: T; errors?: Array<{ message?: string }> };

async function cloudflareGet<T>(credentials: Credentials, path: string) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}${path}`, { headers: { authorization: `Bearer ${credentials.apiToken}`, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => null) as CloudflareResponse<T> | null;
  if (!response.ok || !payload?.success || payload.result === undefined) throw new Error(payload?.errors?.[0]?.message || `Cloudflare Queues returned HTTP ${response.status}.`);
  return payload.result;
}

async function getQueue(credentials: Credentials, queueId: string) { return cloudflareGet<Queue>(credentials, `/queues/${encodeURIComponent(queueId)}`); }
async function getQueueMetrics(credentials: Credentials, queueId: string) { return cloudflareGet<QueueRealtimeMetrics>(credentials, `/queues/${encodeURIComponent(queueId)}/metrics`); }

export async function validateCloudflareQueue(credentials: Credentials, queueId: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(queueId)) throw new Error('Enter a valid Cloudflare Queue ID.');
  const [queue] = await Promise.all([getQueue(credentials, queueId), getQueueMetrics(credentials, queueId)]);
  if (!queue.queue_id || !queue.queue_name) throw new Error('Cloudflare did not return the requested Queue identity.');
  return { queueId: queue.queue_id, queueName: queue.queue_name };
}

export async function syncCloudflareQueuesWorkspace(workspaceId: string) {
  const db = getDb(); const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'cloudflare_queues'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected Cloudflare Queue mappings were found.');
  let written = 0; const queues = [] as Array<{ queueId: string; queueName: string; records: number }>;
  for (const item of mappings) {
    const runId = crypto.randomUUID(); await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'cloudflare_queues', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!item.connector.encryptedCredentials) throw new Error('Cloudflare Queue credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as Credentials;
      const [queue, rawMetrics] = await Promise.all([getQueue(credentials, item.mapping.resourceId), getQueueMetrics(credentials, item.mapping.resourceId)]); const values = normalizeQueueMetrics(rawMetrics, Boolean(queue.settings?.delivery_paused)); const collectedAt = new Date().toISOString(); const metricDate = collectedAt.slice(0, 10); const queueName = queue.queue_name || item.mapping.resourceLabel || item.mapping.resourceId; const dimensionsJson = JSON.stringify({ approximate: true, domain: 'operations', evidenceMode: 'realtime_best_effort', queueId: item.mapping.resourceId, queueName, truncated: true, truncationReason: 'cloudflare_queues_realtime_snapshot_only' });
      const points = Object.entries(values).map(([metric, value]) => ({ workspaceId, productId: item.mapping.productId, source: 'cloudflare_queues', metric, metricDate, value, dimensionsJson, collectedAt }));
      await db.insert(metricPoints).values(points).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; queues.push({ queueId: item.mapping.resourceId, queueName, records: points.length }); await db.update(syncRuns).set({ status: 'success', recordsWritten: points.length, finishedAt: collectedAt }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: collectedAt, updatedAt: collectedAt }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : 'Cloudflare Queue sync failed.'; await db.update(syncRuns).set({ status: 'error', errorCode: 'CLOUDFLARE_QUEUES_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId))); throw error; }
  }
  return { written, queues, evidenceMode: 'realtime_best_effort' as const };
}
