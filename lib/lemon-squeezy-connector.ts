import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { lemonMonthlyRecurringAmount, lemonOrderAmounts, type LemonInterval } from './lemon-squeezy-metrics';
import { SYNC_HISTORY_DAYS } from './history-window';

const apiOrigin = 'https://api.lemonsqueezy.com';
type Credentials = { apiKey: string; storeId: string; storeCurrency: string };
type Resource<T> = { id: string; attributes: T };
type Page<T> = { data: Array<Resource<T>> };
type Store = { name: string; currency: string };
type Order = { store_id: number; customer_id: number; currency: string; total: number; refunded_amount?: number; status: string; created_at: string; test_mode: boolean };
type Subscription = { customer_id: number; status: string; ends_at: string | null; first_subscription_item: { price_id: number; quantity: number } | null; test_mode: boolean };
type Price = { category: string; usage_aggregation: string | null; unit_price: number | null; unit_price_decimal: string | null; renewal_interval_unit: LemonInterval | null; renewal_interval_quantity: number | null };

async function apiGet<T>(apiKey: string, path: string) {
  const response = await fetch(`${apiOrigin}${path}`, { headers: { accept: 'application/vnd.api+json', 'content-type': 'application/vnd.api+json', authorization: `Bearer ${apiKey}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Lemon Squeezy returned HTTP ${response.status}. Check the API key, Store ID, and API access.`);
  return response.json() as Promise<T>;
}

async function listPages<T>(apiKey: string, path: string, stop?: (row: Resource<T>) => boolean) {
  const rows: Array<Resource<T>> = [];
  for (let page = 1; page <= 10; page += 1) { const separator = path.includes('?') ? '&' : '?'; const result = await apiGet<Page<T>>(apiKey, `${path}${separator}page[size]=100&page[number]=${page}`); for (const row of result.data) { if (stop?.(row)) return rows; rows.push(row); } if (result.data.length < 100) break; }
  return rows;
}

export async function validateLemonSqueezyCredentials(apiKey: string, storeId: string) {
  if (!/^\d+$/.test(storeId)) throw new Error('Lemon Squeezy Store ID must be numeric.');
  const result = await apiGet<{ data: Resource<Store> }>(apiKey, `/v1/stores/${storeId}`); const currency = result.data.attributes.currency?.toLowerCase();
  if (!result.data.id || !currency || !/^[a-z]{3}$/.test(currency)) throw new Error('Lemon Squeezy store currency is unavailable.');
  return { storeId: result.data.id, displayName: result.data.attributes.name || `Store ${result.data.id}`, currency };
}

export async function syncLemonSqueezyWorkspace(workspaceId: string) {
  const db = getDb(); const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'lemonsqueezy'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected Lemon Squeezy product mappings were found.');
  let written = 0; const summaries: Array<{ connectorId: string; records: number; currencies: string[] }> = [];
  for (const item of mappings) {
    const runId = crypto.randomUUID(); await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'lemonsqueezy', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!item.connector.encryptedCredentials) throw new Error('Lemon Squeezy credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as Credentials; const cutoff = new Date(Date.now() - SYNC_HISTORY_DAYS * 86400000); const today = new Date().toISOString().slice(0, 10);
      const orders = await listPages<Order>(credentials.apiKey, `/v1/orders?filter[store_id]=${encodeURIComponent(credentials.storeId)}`, (row) => new Date(row.attributes.created_at) < cutoff);
      const daily = new Map<string, { revenue: number; refunds: number }>();
      for (const order of orders.filter((row) => !row.attributes.test_mode)) { const currency = order.attributes.currency.toLowerCase(); if (!/^[a-z]{3}$/.test(currency)) continue; const date = order.attributes.created_at.slice(0, 10); const key = `${date}:${currency}`; const value = daily.get(key) || { revenue: 0, refunds: 0 }; const amounts = lemonOrderAmounts({ status: order.attributes.status, total: order.attributes.total, refundedAmount: order.attributes.refunded_amount || 0 }); value.revenue += amounts.revenueMinor / 100; value.refunds += amounts.refundsMinor / 100; daily.set(key, value); }
      const subscriptions = (await Promise.all(['active', 'cancelled', 'on_trial'].map((status) => listPages<Subscription>(credentials.apiKey, `/v1/subscriptions?filter[store_id]=${encodeURIComponent(credentials.storeId)}&filter[status]=${status}`)))).flat().filter((row) => !row.attributes.test_mode);
      const priceIds = [...new Set(subscriptions.flatMap((row) => row.attributes.first_subscription_item?.price_id ? [String(row.attributes.first_subscription_item.price_id)] : []))]; const prices = new Map<string, Price>();
      for (let index = 0; index < priceIds.length && index < 100; index += 10) { const chunk = priceIds.slice(index, index + 10); const results = await Promise.all(chunk.map((priceId) => apiGet<{ data: Resource<Price> }>(credentials.apiKey, `/v1/prices/${encodeURIComponent(priceId)}`))); results.forEach((result, offset) => prices.set(chunk[offset], result.data.attributes)); }
      let mrrMinor = 0; const paid = new Set<number>(); const trials = new Set<number>();
      for (const subscription of subscriptions) { const attributes = subscription.attributes; if (attributes.status === 'on_trial') { trials.add(attributes.customer_id); continue; } if (attributes.status === 'cancelled' && (!attributes.ends_at || new Date(attributes.ends_at) <= new Date())) continue; const itemRow = attributes.first_subscription_item; if (!itemRow) continue; const price = prices.get(String(itemRow.price_id)); if (!price || price.category !== 'subscription') continue; const unitAmount = price.unit_price ?? (price.unit_price_decimal ? Number(price.unit_price_decimal) : null); const value = lemonMonthlyRecurringAmount({ unitAmount, quantity: itemRow.quantity, interval: price.renewal_interval_unit, intervalCount: price.renewal_interval_quantity, usageBased: Boolean(price.usage_aggregation) }); if (!value) continue; mrrMinor += value; paid.add(attributes.customer_id); }
      const points = [...daily].flatMap(([key, value]) => { const [metricDate, currency] = key.split(':'); const dimensionsJson = JSON.stringify({ currency }); const collectedAt = new Date().toISOString(); return [{ workspaceId, productId: item.mapping.productId, source: 'lemonsqueezy', metric: 'revenue', metricDate, value: value.revenue, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'lemonsqueezy', metric: 'refunds', metricDate, value: value.refunds, dimensionsJson, collectedAt }]; });
      const dimensionsJson = JSON.stringify({ currency: credentials.storeCurrency }); const collectedAt = new Date().toISOString(); points.push({ workspaceId, productId: item.mapping.productId, source: 'lemonsqueezy', metric: 'mrr', metricDate: today, value: mrrMinor / 100, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'lemonsqueezy', metric: 'paid_customers', metricDate: today, value: paid.size, dimensionsJson, collectedAt }, { workspaceId, productId: item.mapping.productId, source: 'lemonsqueezy', metric: 'trialing_customers', metricDate: today, value: trials.size, dimensionsJson, collectedAt });
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; summaries.push({ connectorId: item.connector.id, records: points.length, currencies: [...new Set([...daily.keys()].map((key) => key.split(':')[1]).concat(credentials.storeCurrency))] }); await db.update(syncRuns).set({ status: 'success', recordsWritten: points.length, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : 'Lemon Squeezy sync failed.'; await db.update(syncRuns).set({ status: 'error', errorCode: 'LEMON_SQUEEZY_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId))); throw error; }
  }
  return { written, connectors: summaries };
}
