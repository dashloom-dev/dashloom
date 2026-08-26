import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { D1MetricConfiguration, validateReadOnlyQuery } from './d1-query';

export { validateReadOnlyQuery } from './d1-query';
export type { D1MetricConfiguration } from './d1-query';

export type D1Credentials = { accountId: string; databaseId: string; apiToken: string };

async function cloudflareRequest(credentials: D1Credentials, path: string, init?: RequestInit) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/d1/database/${encodeURIComponent(credentials.databaseId)}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${credentials.apiToken}`, accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => null) as { success?: boolean; errors?: Array<{ message?: string }>; result?: unknown } | null;
  if (!response.ok || !payload?.success) throw new Error(payload?.errors?.[0]?.message || `Cloudflare D1 returned HTTP ${response.status}.`);
  return payload.result;
}

export async function validateD1Credentials(credentials: D1Credentials) {
  await cloudflareRequest(credentials, '');
}

async function executeReadOnlyQuery(credentials: D1Credentials, configuration: D1MetricConfiguration) {
  const result = await cloudflareRequest(credentials, '/query', { method: 'POST', body: JSON.stringify({ sql: configuration.sql, params: [] }) }) as Array<{ results?: Array<Record<string, unknown>>; meta?: { rows_written?: number } }>;
  const queryResult = Array.isArray(result) ? result[0] : undefined;
  if ((queryResult?.meta?.rows_written || 0) !== 0) throw new Error('The D1 query modified data and was rejected.');
  const rows = queryResult?.results || [];
  if (rows.length > 5000) throw new Error('The D1 query returned more than 5,000 rows. Aggregate or narrow the date range.');
  return rows;
}

export async function syncD1Workspace(workspaceId: string) {
  const db = getDb();
  const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings)
    .innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id))
    .where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'd1'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected D1 metric mappings were found.');
  let written = 0;
  const summaries: Array<{ connectorId: string; records: number }> = [];
  for (const item of mappings) {
    const runId = crypto.randomUUID();
    await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'd1', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!item.connector.encryptedCredentials) throw new Error('D1 credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as D1Credentials;
      const configuration = validateReadOnlyQuery(JSON.parse(item.mapping.configurationJson) as D1MetricConfiguration);
      const rows = await executeReadOnlyQuery(credentials, configuration);
      const points = rows.flatMap((row) => {
        const rawDate = row[configuration.dateColumn];
        const metricDate = typeof rawDate === 'string' ? rawDate.slice(0, 10) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(metricDate)) return [];
        return Object.entries(configuration.metrics).flatMap(([column, metric]) => {
          const value = Number(row[column]);
          return Number.isFinite(value) ? [{ workspaceId, productId: item.mapping.productId, source: 'd1', metric, metricDate, value, dimensionsJson: '{}', collectedAt: new Date().toISOString() }] : [];
        });
      });
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({
        target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson],
        set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` },
      });
      written += points.length;
      summaries.push({ connectorId: item.connector.id, records: points.length });
      await db.update(syncRuns).set({ status: 'success', recordsWritten: points.length, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId));
      await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(connectorAccounts.id, item.connector.id));
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'D1 sync failed.';
      await db.update(syncRuns).set({ status: 'error', errorCode: 'D1_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId));
      await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(connectorAccounts.id, item.connector.id));
      throw error;
    }
  }
  return { written, connectors: summaries };
}
