import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { creemTimestamp, creemTransactionAmounts, type CreemTransaction } from './creem-metrics';
import { syncHistoryStart } from './history-window';

export type CreemEnvironment = 'production' | 'test';
type Credentials = { apiKey: string; environment: CreemEnvironment; productId: string | null };
type Page = { items?: CreemTransaction[]; pagination?: { current_page?: number; next_page?: number | null; total_records?: number } };

function apiOrigin(environment: CreemEnvironment) { return environment === 'test' ? 'https://test-api.creem.io' : 'https://api.creem.io'; }

async function apiGet<T>(credentials: Pick<Credentials, 'apiKey' | 'environment'>, path: string) {
  const response = await fetch(`${apiOrigin(credentials.environment)}${path}`, { headers: { accept: 'application/json', 'x-api-key': credentials.apiKey }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Creem returned HTTP ${response.status}. Check the API key and selected environment.`);
  return response.json() as Promise<T>;
}

async function fingerprint(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function validateCreemCredentials(apiKey: string, environment: CreemEnvironment, productId?: string | null, fingerprintScope = '') {
  const normalizedProduct = productId?.trim() || null;
  if (normalizedProduct && !/^prod_[A-Za-z0-9_-]{4,100}$/.test(normalizedProduct)) throw new Error('Creem Product ID must start with prod_.');
  const credentials = { apiKey, environment };
  const params = new URLSearchParams({ page_number: '1', page_size: '1' });
  if (normalizedProduct) params.set('product_id', normalizedProduct);
  const result = await apiGet<Page>(credentials, `/v1/transactions/search?${params}`);
  return { fingerprint: await fingerprint(`${fingerprintScope}:${apiKey}`), environment, productId: normalizedProduct, transactionCount: Math.max(0, result.pagination?.total_records || 0) };
}

async function listTransactions(credentials: Credentials) {
  const rows: CreemTransaction[] = []; const cutoff = syncHistoryStart(); let truncated = false;
  for (let page = 1; page <= 10; page += 1) {
    const params = new URLSearchParams({ page_number: String(page), page_size: '100' });
    if (credentials.productId) params.set('product_id', credentials.productId);
    const result = await apiGet<Page>(credentials, `/v1/transactions/search?${params}`); const items = result.items || [];
    for (const item of items) { const created = creemTimestamp(item.created_at); if (created && created.toISOString().slice(0, 10) >= cutoff) rows.push(item); }
    if (!result.pagination?.next_page || items.length < 100) return { rows, truncated: false };
    if (page === 10) truncated = true;
  }
  return { rows, truncated };
}

export async function syncCreemWorkspace(workspaceId: string) {
  const db = getDb(); const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'creem'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected Creem product mappings were found.');
  let written = 0; const summaries: Array<{ connectorId: string; records: number; currencies: string[]; truncated: boolean }> = [];
  for (const item of mappings) {
    const runId = crypto.randomUUID(); await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'creem', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!item.connector.encryptedCredentials) throw new Error('Creem credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as Credentials; const transactions = await listTransactions(credentials); const daily = new Map<string, { revenue: number; refunds: number; transactions: number; chargebacks: number }>();
      for (const transaction of transactions.rows) { const created = creemTimestamp(transaction.created_at); const currency = transaction.currency?.toLowerCase(); if (!created || !currency || !/^[a-z]{3}$/.test(currency)) continue; const key = `${created.toISOString().slice(0, 10)}:${currency}`; const value = daily.get(key) || { revenue: 0, refunds: 0, transactions: 0, chargebacks: 0 }; const amounts = creemTransactionAmounts(transaction); value.revenue += amounts.revenueMinor / 100; value.refunds += amounts.refundsMinor / 100; value.transactions += amounts.paidTransactions; value.chargebacks += amounts.chargebacks; daily.set(key, value); }
      const collectedAt = new Date().toISOString(); const points = [...daily].flatMap(([key, value]) => { const [metricDate, currency] = key.split(':'); const dimensionsJson = JSON.stringify({ currency, ...(transactions.truncated ? { truncated: true } : {}) }); return [{ workspaceId, productId: item.mapping.productId, source: 'creem', metric: 'revenue', metricDate, value: value.revenue, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'creem', metric: 'refunds', metricDate, value: value.refunds, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'creem', metric: 'paid_transactions', metricDate, value: value.transactions, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'creem', metric: 'chargebacks', metricDate, value: value.chargebacks, dimensionsJson, collectedAt }]; });
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; summaries.push({ connectorId: item.connector.id, records: points.length, currencies: [...new Set([...daily.keys()].map((key) => key.split(':')[1]))], truncated: transactions.truncated }); await db.update(syncRuns).set({ status: transactions.truncated ? 'partial' : 'success', recordsWritten: points.length, errorMessage: transactions.truncated ? 'Creem transaction history reached the 1,000-record synchronization limit.' : null, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : 'Creem synchronization failed.'; await db.update(syncRuns).set({ status: 'error', errorCode: 'CREEM_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId))); throw error; }
  }
  return { written, connectors: summaries };
}
