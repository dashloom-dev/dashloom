import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { syncHistoryStart } from './history-window';
import { paddleAdjustmentAmounts, paddleDate, paddleMetricDimensions, paddleTransactionAmounts, type PaddleAdjustment, type PaddleTransaction } from './paddle-metrics';
import { safePaddleApiUrl, type PaddleEnvironment } from './paddle-api-policy';

type Credentials = { apiKey: string; environment: PaddleEnvironment };
type Page<T> = { data?: T[]; meta?: { pagination?: { next?: string; has_more?: boolean; estimated_total?: number } } };
async function apiGet<T>(credentials: Credentials, target: string, allowedPath: '/transactions' | '/adjustments', skipCount = true) {
  const response = await fetch(safePaddleApiUrl(credentials.environment, target, allowedPath), { headers: { accept: 'application/json', authorization: `Bearer ${credentials.apiKey}`, 'Paddle-Version': '1', ...(skipCount ? { 'Skip-Count': 'true' } : {}) }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Paddle returned HTTP ${response.status}. Check the transaction.read and adjustment.read permissions and selected environment.`);
  return response.json() as Promise<T>;
}
async function fingerprint(secret: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)); return [...new Uint8Array(digest)].slice(0, 12).map((value) => value.toString(16).padStart(2, '0')).join(''); }
function recentStartIso() { return `${syncHistoryStart()}T00:00:00.000Z`; }

export async function validatePaddleCredentials(apiKey: string, environment: PaddleEnvironment, fingerprintScope = '') {
  const credentials = { apiKey, environment }; const transactions = new URLSearchParams({ status: 'completed', per_page: '1' }); const adjustments = new URLSearchParams({ status: 'approved', per_page: '1' });
  const [transactionPage, adjustmentPage] = await Promise.all([apiGet<Page<PaddleTransaction>>(credentials, `/transactions?${transactions}`, '/transactions', false), apiGet<Page<PaddleAdjustment>>(credentials, `/adjustments?${adjustments}`, '/adjustments', false)]);
  return { fingerprint: await fingerprint(`${fingerprintScope}:${apiKey}`), environment, transactionCount: Math.max(0, transactionPage.meta?.pagination?.estimated_total || transactionPage.data?.length || 0), adjustmentCount: Math.max(0, adjustmentPage.meta?.pagination?.estimated_total || adjustmentPage.data?.length || 0) };
}

async function listTransactions(credentials: Credentials) {
  const cutoff = syncHistoryStart(); const params = new URLSearchParams({ status: 'completed', per_page: '30', order_by: 'billed_at[DESC]', 'billed_at[GTE]': recentStartIso() }); let target = `/transactions?${params}`; const rows: PaddleTransaction[] = [];
  for (let page = 1; page <= 34; page += 1) { const result = await apiGet<Page<PaddleTransaction>>(credentials, target, '/transactions'); const items = result.data || []; for (const item of items) { const date = paddleDate(item.billed_at || item.created_at); if (date && date.toISOString().slice(0, 10) >= cutoff) rows.push(item); } const pagination = result.meta?.pagination; if (!pagination?.has_more) return { rows, truncated: false }; if (!pagination.next) throw new Error('Paddle transaction pagination did not include the next URL.'); target = pagination.next; }
  return { rows, truncated: true };
}

async function listAdjustments(credentials: Credentials) {
  const cutoff = syncHistoryStart(); const params = new URLSearchParams({ status: 'approved', action: 'refund,chargeback,chargeback_reverse', per_page: '50', order_by: 'id[DESC]' }); let target = `/adjustments?${params}`; const rows: PaddleAdjustment[] = [];
  for (let page = 1; page <= 20; page += 1) { const result = await apiGet<Page<PaddleAdjustment>>(credentials, target, '/adjustments'); const items = result.data || []; for (const item of items) { const date = paddleDate(item.created_at); if (date && date.toISOString().slice(0, 10) >= cutoff) rows.push(item); } const oldest = paddleDate(items.at(-1)?.created_at)?.toISOString().slice(0, 10); const pagination = result.meta?.pagination; if (!pagination?.has_more || (oldest && oldest < cutoff)) return { rows, truncated: false }; if (!pagination.next) throw new Error('Paddle adjustment pagination did not include the next URL.'); target = pagination.next; }
  return { rows, truncated: true };
}

export async function syncPaddleWorkspace(workspaceId: string) {
  const db = getDb(); const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'paddle'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected Paddle product mappings were found.');
  let written = 0; const summaries: Array<{ connectorId: string; records: number; currencies: string[]; truncated: boolean }> = [];
  for (const item of mappings) {
    const runId = crypto.randomUUID(); await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'paddle', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!item.connector.encryptedCredentials) throw new Error('Paddle credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as Credentials; const [transactions, adjustments] = await Promise.all([listTransactions(credentials), listAdjustments(credentials)]); const daily = new Map<string, { revenue: number; refunds: number; chargebacks: number; transactions: number; subscriptions: number }>();
      for (const transaction of transactions.rows) { const date = paddleDate(transaction.billed_at || transaction.created_at); const currency = transaction.currency_code?.toLowerCase(); if (!date || !currency || !/^[a-z]{3}$/.test(currency)) continue; const key = `${date.toISOString().slice(0, 10)}:${currency}`; const value = daily.get(key) || { revenue: 0, refunds: 0, chargebacks: 0, transactions: 0, subscriptions: 0 }; const amounts = paddleTransactionAmounts(transaction); value.revenue += amounts.revenue; value.transactions += amounts.paidTransactions; value.subscriptions += amounts.subscriptionTransactions; daily.set(key, value); }
      for (const adjustment of adjustments.rows) { const date = paddleDate(adjustment.created_at); const currency = adjustment.currency_code?.toLowerCase(); if (!date || !currency || !/^[a-z]{3}$/.test(currency)) continue; const key = `${date.toISOString().slice(0, 10)}:${currency}`; const value = daily.get(key) || { revenue: 0, refunds: 0, chargebacks: 0, transactions: 0, subscriptions: 0 }; const amounts = paddleAdjustmentAmounts(adjustment); value.refunds += amounts.refunds; value.chargebacks += amounts.chargebacks; daily.set(key, value); }
      const truncated = transactions.truncated || adjustments.truncated; const collectedAt = new Date().toISOString(); const points = [...daily].flatMap(([key, value]) => { const [metricDate, currency] = key.split(':'); const dimensionsJson = paddleMetricDimensions(currency, truncated); return [{ workspaceId, productId: item.mapping.productId, source: 'paddle', metric: 'revenue', metricDate, value: value.revenue, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'paddle', metric: 'refunds', metricDate, value: value.refunds, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'paddle', metric: 'chargebacks', metricDate, value: value.chargebacks, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'paddle', metric: 'paid_transactions', metricDate, value: value.transactions, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'paddle', metric: 'subscription_transactions', metricDate, value: value.subscriptions, dimensionsJson, collectedAt }]; });
      await db.delete(metricPoints).where(and(eq(metricPoints.workspaceId, workspaceId), eq(metricPoints.productId, item.mapping.productId), eq(metricPoints.source, 'paddle'), gte(metricPoints.metricDate, syncHistoryStart())));
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; summaries.push({ connectorId: item.connector.id, records: points.length, currencies: [...new Set([...daily.keys()].map((key) => key.split(':')[1]))], truncated }); await db.update(syncRuns).set({ status: truncated ? 'partial' : 'success', recordsWritten: points.length, errorMessage: truncated ? 'Paddle history reached the bounded transaction or adjustment collection limit.' : null, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : 'Paddle synchronization failed.'; await db.update(syncRuns).set({ status: 'error', errorCode: 'PADDLE_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId))); throw error; }
  }
  return { written, connectors: summaries };
}
