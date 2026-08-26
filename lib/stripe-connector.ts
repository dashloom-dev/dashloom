import Stripe from 'stripe';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { monthlyRecurringAmount, stripeMinorUnitDivisor, stripeTransactionMetric, type RecurringInterval } from './stripe-metrics';
import { SYNC_HISTORY_DAYS } from './history-window';

const apiVersion = '2026-07-29.dahlia' as const;
type StripeCredentials = { apiKey: string; defaultCurrency: string };
function client(apiKey: string) { return new Stripe(apiKey, { apiVersion, maxNetworkRetries: 2, timeout: 15000 }); }

export async function validateStripeCredentials(apiKey: string) {
  if (!/^(rk|sk)_(test|live)_/.test(apiKey)) throw new Error('Use a Stripe secret or restricted server key. Publishable keys cannot read revenue evidence.');
  const stripe = client(apiKey); const [account] = await Promise.all([stripe.accounts.retrieve(null), stripe.balanceTransactions.list({ limit: 1 }), stripe.subscriptions.list({ status: 'active', limit: 1 })]);
  if (!account.id || !account.default_currency) throw new Error('Stripe account details are unavailable to this key.');
  return { accountId: account.id, displayName: account.business_profile?.name || account.settings?.dashboard?.display_name || account.id, defaultCurrency: account.default_currency.toLowerCase() };
}

async function listRecentTransactions(stripe: Stripe, createdGte: number) {
  const rows: Stripe.BalanceTransaction[] = []; let startingAfter: string | undefined;
  do { const page = await stripe.balanceTransactions.list({ created: { gte: createdGte }, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) }); rows.push(...page.data); startingAfter = page.has_more && rows.length < 1000 ? page.data.at(-1)?.id : undefined; } while (startingAfter);
  return rows;
}

async function listCurrentSubscriptions(stripe: Stripe) {
  const rows: Stripe.Subscription[] = [];
  for (const status of ['active', 'trialing'] as const) { let startingAfter: string | undefined; let scanned = 0; do { const page = await stripe.subscriptions.list({ status, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) }); rows.push(...page.data); scanned += page.data.length; startingAfter = page.has_more && scanned < 1000 ? page.data.at(-1)?.id : undefined; } while (startingAfter); }
  return rows;
}

async function subscriptionItems(stripe: Stripe, subscription: Stripe.Subscription) { if (!subscription.items.has_more) return subscription.items.data; const rows: Stripe.SubscriptionItem[] = []; let startingAfter: string | undefined; do { const page = await stripe.subscriptionItems.list({ subscription: subscription.id, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) }); rows.push(...page.data); startingAfter = page.has_more && rows.length < 500 ? page.data.at(-1)?.id : undefined; } while (startingAfter); return rows; }

export async function syncStripeWorkspace(workspaceId: string) {
  const db = getDb(); const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'stripe'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected Stripe product mappings were found.');
  let written = 0; const summaries: Array<{ connectorId: string; records: number; currency: string }> = [];
  for (const item of mappings) {
    const runId = crypto.randomUUID(); await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'stripe', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!item.connector.encryptedCredentials) throw new Error('Stripe credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as StripeCredentials; const stripe = client(credentials.apiKey); const today = new Date().toISOString().slice(0, 10); const createdGte = Math.floor((Date.now() - SYNC_HISTORY_DAYS * 86400000) / 1000);
      const [transactions, subscriptions] = await Promise.all([listRecentTransactions(stripe, createdGte), listCurrentSubscriptions(stripe)]); const daily = new Map<string, { revenue: number; refunds: number }>();
      const divisor = stripeMinorUnitDivisor(credentials.defaultCurrency);
      for (const transaction of transactions.filter((value) => value.currency.toLowerCase() === credentials.defaultCurrency)) { const metric = stripeTransactionMetric(transaction.reporting_category); if (!metric) continue; const date = new Date(transaction.created * 1000).toISOString().slice(0, 10); const value = daily.get(date) || { revenue: 0, refunds: 0 }; value[metric] += Math.abs(transaction.amount) / divisor; daily.set(date, value); }
      let mrrMinor = 0; const customers = new Set<string>(); const trialingCustomers = new Set<string>();
      for (const subscription of subscriptions) { const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id; let subscriptionMrr = 0; for (const subscriptionItem of await subscriptionItems(stripe, subscription)) { const price = subscriptionItem.price; const recurring = price.recurring; const unitAmount = price.unit_amount ?? (price.unit_amount_decimal ? Number(price.unit_amount_decimal) : null); if (!recurring || recurring.usage_type === 'metered' || unitAmount === null || !Number.isFinite(unitAmount) || price.currency.toLowerCase() !== credentials.defaultCurrency || !['day', 'week', 'month', 'year'].includes(recurring.interval)) continue; subscriptionMrr += monthlyRecurringAmount({ unitAmount, quantity: subscriptionItem.quantity ?? null, interval: recurring.interval as RecurringInterval, intervalCount: recurring.interval_count }); } if (!subscriptionMrr) continue; if (subscription.status === 'active') { mrrMinor += subscriptionMrr; customers.add(customerId); } else trialingCustomers.add(customerId); }
      const dimensionsJson = JSON.stringify({ currency: credentials.defaultCurrency }); const points = [...daily].flatMap(([metricDate, value]) => [{ workspaceId, productId: item.mapping.productId, source: 'stripe', metric: 'revenue', metricDate, value: value.revenue, dimensionsJson, collectedAt: new Date().toISOString() }, { workspaceId, productId: item.mapping.productId, source: 'stripe', metric: 'refunds', metricDate, value: value.refunds, dimensionsJson, collectedAt: new Date().toISOString() }]); points.push({ workspaceId, productId: item.mapping.productId, source: 'stripe', metric: 'mrr', metricDate: today, value: mrrMinor / divisor, dimensionsJson, collectedAt: new Date().toISOString() }, { workspaceId, productId: item.mapping.productId, source: 'stripe', metric: 'paid_customers', metricDate: today, value: customers.size, dimensionsJson, collectedAt: new Date().toISOString() }, { workspaceId, productId: item.mapping.productId, source: 'stripe', metric: 'trialing_customers', metricDate: today, value: trialingCustomers.size, dimensionsJson, collectedAt: new Date().toISOString() });
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; summaries.push({ connectorId: item.connector.id, records: points.length, currency: credentials.defaultCurrency }); await db.update(syncRuns).set({ status: 'success', recordsWritten: points.length, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : 'Stripe sync failed.'; await db.update(syncRuns).set({ status: 'error', errorCode: 'STRIPE_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId))); throw error; }
  }
  return { written, connectors: summaries };
}
