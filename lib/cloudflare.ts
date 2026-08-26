import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { boundedHistoryRanges } from './history-window';

type CloudflareCredentials = { accountId: string; apiToken: string };
type WorkerRow = { dimensions?: { date?: string }; sum?: { requests?: number; errors?: number; subrequests?: number; wallTime?: number }; quantiles?: { cpuTimeP50?: number; cpuTimeP99?: number } };

export async function discoverCloudflareWorkers(credentials: CloudflareCredentials) {
  await validateCloudflareCredentials(credentials);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/workers/scripts?per_page=100`, {
    headers: { authorization: `Bearer ${credentials.apiToken}`, accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Cloudflare Worker discovery returned HTTP ${response.status}. Add Workers Scripts Read permission or enter the script name manually.`);
  const payload = await response.json() as { success?: boolean; result?: Array<{ id?: string; modified_on?: string }>; errors?: Array<{ message?: string }> };
  if (!payload.success) throw new Error(payload.errors?.[0]?.message || 'Cloudflare Worker discovery failed.');
  return (payload.result || []).flatMap((worker) => worker.id ? [{ id: worker.id, name: worker.id, modifiedAt: worker.modified_on || null }] : []).sort((a, b) => a.name.localeCompare(b.name));
}

export async function validateCloudflareCredentials(credentials: CloudflareCredentials) {
  const headers = { authorization: `Bearer ${credentials.apiToken}`, accept: 'application/json' };
  const [token, account] = await Promise.all([
    fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers, signal: AbortSignal.timeout(10000) }),
    fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}`, { headers, signal: AbortSignal.timeout(10000) }),
  ]);
  if (!token.ok) throw new Error(`Cloudflare token verification returned HTTP ${token.status}.`);
  if (!account.ok) throw new Error(`Cloudflare account access returned HTTP ${account.status}.`);
}

export async function syncCloudflareWorkspace(workspaceId: string) {
  const db = getDb();
  const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'cloudflare'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected Cloudflare Worker mappings were found.');
  const byConnector = new Map<string, typeof mappings>();
  for (const item of mappings) byConnector.set(item.connector.id, [...(byConnector.get(item.connector.id) || []), item]);
  let written = 0;
  const summaries: Array<{ connectorId: string; records: number }> = [];
  for (const [connectorId, items] of byConnector) {
    const connector = items[0].connector;
    const runId = crypto.randomUUID();
    await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: connectorId, source: 'cloudflare', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!connector.encryptedCredentials) throw new Error('Cloudflare credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(connector.encryptedCredentials, `connector:${workspaceId}:${connectorId}`)) as CloudflareCredentials;
      const baseVariables: Record<string, string> = { accountTag: credentials.accountId };
      const declarations = ['$accountTag: string!', '$start: Time!', '$end: Time!'];
      const selections = items.map((item, index) => {
        baseVariables[`script${index}`] = item.mapping.resourceId;
        declarations.push(`$script${index}: string!`);
        return `s${index}: workersInvocationsAdaptive(filter:{datetime_geq:$start,datetime_leq:$end,scriptName:$script${index}},limit:1000,orderBy:[date_ASC]) { dimensions { date } sum { requests errors subrequests wallTime } quantiles { cpuTimeP50 cpuTimeP99 } }`;
      });
      const query = `query WorkerDaily(${declarations.join(',')}) { viewer { accounts(filter:{accountTag:$accountTag}) { ${selections.join('\n')} } } }`;
      const accounts: Array<Record<string, WorkerRow[]>> = [];
      for (const range of boundedHistoryRanges(30)) {
        const variables = { ...baseVariables, start: `${range.start}T00:00:00Z`, end: `${range.end}T23:59:59Z` };
        const response = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { authorization: `Bearer ${credentials.apiToken}`, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Cloudflare GraphQL returned HTTP ${response.status}.`);
        const payload = await response.json() as { data?: { viewer?: { accounts?: Array<Record<string, WorkerRow[]>> } }; errors?: Array<{ message?: string }> };
        if (payload.errors?.length) throw new Error(payload.errors[0].message || 'Cloudflare GraphQL returned an error.');
        accounts.push(payload.data?.viewer?.accounts?.[0] || {});
      }
      const points = accounts.flatMap((account) => items.flatMap((item, index) => (account[`s${index}`] || []).flatMap((row) => {
        const date = row.dimensions?.date;
        if (!date) return [];
        return [
          { workspaceId, productId: item.mapping.productId, source: 'cloudflare', metric: 'requests', metricDate: date, value: row.sum?.requests || 0, dimensionsJson: '{}', collectedAt: new Date().toISOString() },
          { workspaceId, productId: item.mapping.productId, source: 'cloudflare', metric: 'errors', metricDate: date, value: row.sum?.errors || 0, dimensionsJson: '{}', collectedAt: new Date().toISOString() },
          { workspaceId, productId: item.mapping.productId, source: 'cloudflare', metric: 'subrequests', metricDate: date, value: row.sum?.subrequests || 0, dimensionsJson: '{}', collectedAt: new Date().toISOString() },
          { workspaceId, productId: item.mapping.productId, source: 'cloudflare', metric: 'wall_time', metricDate: date, value: row.sum?.wallTime || 0, dimensionsJson: '{}', collectedAt: new Date().toISOString() },
          { workspaceId, productId: item.mapping.productId, source: 'cloudflare', metric: 'cpu_time_p50', metricDate: date, value: row.quantiles?.cpuTimeP50 || 0, dimensionsJson: '{}', collectedAt: new Date().toISOString() },
          { workspaceId, productId: item.mapping.productId, source: 'cloudflare', metric: 'cpu_time_p99', metricDate: date, value: row.quantiles?.cpuTimeP99 || 0, dimensionsJson: '{}', collectedAt: new Date().toISOString() },
        ];
      })));
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; summaries.push({ connectorId, records: points.length });
      await db.update(syncRuns).set({ status: 'success', recordsWritten: points.length, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId));
      await db.update(connectorAccounts).set({ lastCheckedAt: new Date().toISOString(), status: 'connected', updatedAt: new Date().toISOString() }).where(eq(connectorAccounts.id, connectorId));
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Cloudflare sync failed.';
      await db.update(syncRuns).set({ status: 'error', errorCode: 'CLOUDFLARE_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId));
      await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(connectorAccounts.id, connectorId));
      throw error;
    }
  }
  return { written, connectors: summaries };
}
