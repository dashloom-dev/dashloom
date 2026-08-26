import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { syncHistoryStart } from './history-window';
import { polarOrderAmounts, polarOrderDate, type PolarOrder } from './polar-metrics';

export type PolarEnvironment = 'production' | 'sandbox';
type Credentials = { accessToken: string; environment: PolarEnvironment; productId: string | null };
type Page = { items?: PolarOrder[]; pagination?: { total_count?: number; max_page?: number } };

function origin(environment: PolarEnvironment) { return environment === 'sandbox' ? 'https://sandbox-api.polar.sh/v1' : 'https://api.polar.sh/v1'; }

async function apiGet<T>(credentials: Pick<Credentials, 'accessToken' | 'environment'>, path: string) {
  const response = await fetch(`${origin(credentials.environment)}${path}`, { headers: { accept: 'application/json', authorization: `Bearer ${credentials.accessToken}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Polar returned HTTP ${response.status}. Check the orders:read token and selected environment.`);
  return response.json() as Promise<T>;
}

async function fingerprint(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) => value.toString(16).padStart(2, '0')).join('');
}

function orderPath(page: number, productId: string | null) {
  const params = new URLSearchParams({ page: String(page), limit: '100', sorting: '-created_at' });
  if (productId) params.set('product_id', productId);
  return `/orders?${params}`;
}

export async function validatePolarCredentials(accessToken: string, environment: PolarEnvironment, productId?: string | null, fingerprintScope = '') {
  const normalizedProduct = productId?.trim() || null;
  if (normalizedProduct && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedProduct)) throw new Error('Polar Product ID must be a UUID.');
  const result = await apiGet<Page>({ accessToken, environment }, orderPath(1, normalizedProduct));
  return { fingerprint: await fingerprint(`${fingerprintScope}:${accessToken}`), environment, productId: normalizedProduct, orderCount: Math.max(0, result.pagination?.total_count || result.items?.length || 0) };
}

async function listOrders(credentials: Credentials) {
  const rows: PolarOrder[] = []; const cutoff = syncHistoryStart();
  for (let page = 1; page <= 10; page += 1) {
    const result = await apiGet<Page>(credentials, orderPath(page, credentials.productId)); const items = result.items || [];
    for (const item of items) { const created = polarOrderDate(item.created_at); if (created && created.toISOString().slice(0, 10) >= cutoff) rows.push(item); }
    const oldest = polarOrderDate(items.at(-1)?.created_at)?.toISOString().slice(0, 10); const hasNext = page < (result.pagination?.max_page || page);
    if (!hasNext || items.length < 100 || (oldest && oldest < cutoff)) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export async function syncPolarWorkspace(workspaceId: string) {
  const db = getDb(); const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'polar'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected Polar product mappings were found.');
  let written = 0; const summaries: Array<{ connectorId: string; records: number; currencies: string[]; truncated: boolean }> = [];
  for (const item of mappings) {
    const runId = crypto.randomUUID(); await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'polar', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!item.connector.encryptedCredentials) throw new Error('Polar credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as Credentials; const orders = await listOrders(credentials); const daily = new Map<string, { revenue: number; refunds: number; transactions: number }>();
      for (const order of orders.rows) { const created = polarOrderDate(order.created_at); const currency = order.currency?.toLowerCase(); if (!created || !currency || !/^[a-z]{3}$/.test(currency)) continue; const key = `${created.toISOString().slice(0, 10)}:${currency}`; const value = daily.get(key) || { revenue: 0, refunds: 0, transactions: 0 }; const amounts = polarOrderAmounts(order); value.revenue += amounts.revenueMinor / 100; value.refunds += amounts.refundsMinor / 100; value.transactions += amounts.paidTransactions; daily.set(key, value); }
      const collectedAt = new Date().toISOString(); const points = [...daily].flatMap(([key, value]) => { const [metricDate, currency] = key.split(':'); const dimensionsJson = JSON.stringify({ currency, ...(orders.truncated ? { truncated: true } : {}) }); return [{ workspaceId, productId: item.mapping.productId, source: 'polar', metric: 'revenue', metricDate, value: value.revenue, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'polar', metric: 'refunds', metricDate, value: value.refunds, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'polar', metric: 'paid_transactions', metricDate, value: value.transactions, dimensionsJson, collectedAt }]; });
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; summaries.push({ connectorId: item.connector.id, records: points.length, currencies: [...new Set([...daily.keys()].map((key) => key.split(':')[1]))], truncated: orders.truncated }); await db.update(syncRuns).set({ status: orders.truncated ? 'partial' : 'success', recordsWritten: points.length, errorMessage: orders.truncated ? 'Polar order history reached the 1,000-record synchronization limit.' : null, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : 'Polar synchronization failed.'; await db.update(syncRuns).set({ status: 'error', errorCode: 'POLAR_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId))); throw error; }
  }
  return { written, connectors: summaries };
}
