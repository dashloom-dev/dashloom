export const guidedBusinessMetrics = ['revenue', 'orders', 'signups', 'active_subscriptions'] as const;

export type GuidedBusinessMetric = typeof guidedBusinessMetrics[number];
export type DiscoveryConfidence = 'high' | 'medium' | 'low';
export type DiscoveredColumn = { name: string; type: string; primaryKey?: boolean };
export type DiscoveredResource = { name: string; columns: DiscoveredColumn[] };

export type GuidedMetricMapping = {
  metric: GuidedBusinessMetric;
  resource: string;
  valueColumn: string;
  dateColumn?: string;
  filterColumn?: string;
  filterValues?: string[];
  scale?: number;
  confidence: DiscoveryConfidence;
  reason: string;
};

export type GuidedMetricSuggestion = {
  metric: GuidedBusinessMetric;
  options: GuidedMetricMapping[];
};

const resourceHints: Record<GuidedBusinessMetric, string[]> = {
  revenue: ['transactions', 'payments', 'orders', 'invoices', 'purchases', 'sales', 'revenue'],
  orders: ['orders', 'transactions', 'purchases', 'payments', 'sales'],
  signups: ['users', 'profiles', 'accounts', 'customers', 'members'],
  active_subscriptions: ['subscriptions', 'memberships', 'plans', 'licenses'],
};

const valueHints: Record<GuidedBusinessMetric, string[]> = {
  revenue: ['amount_cents', 'total_cents', 'amount', 'total', 'revenue', 'gross_amount', 'net_amount', 'price'],
  orders: ['id', 'order_id', 'transaction_id', 'payment_id'],
  signups: ['id', 'user_id', 'account_id', 'customer_id'],
  active_subscriptions: ['id', 'subscription_id', 'membership_id'],
};

const dateHints: Record<GuidedBusinessMetric, string[]> = {
  revenue: ['paid_at', 'completed_at', 'created_at', 'processed_at', 'date', 'metric_date'],
  orders: ['paid_at', 'completed_at', 'created_at', 'ordered_at', 'date', 'metric_date'],
  signups: ['created_at', 'signed_up_at', 'registered_at', 'joined_at', 'date', 'metric_date'],
  active_subscriptions: ['updated_at', 'created_at', 'started_at', 'date', 'metric_date'],
};

const statusHints = ['status', 'state', 'subscription_status'];
const activeStatusValues = ['active', 'trialing'];
const successfulPaymentStatusValues = ['paid', 'completed', 'complete', 'succeeded', 'success', 'captured'];

function normalized(value: string) { return value.trim().toLowerCase(); }
function indexScore(value: string, hints: string[]) {
  const name = normalized(value);
  const index = hints.findIndex((hint) => name === hint || name.startsWith(`${hint}_`) || name.endsWith(`_${hint}`) || name.includes(`_${hint}_`));
  return index < 0 ? 0 : Math.max(1, hints.length - index);
}

function confidenceFor(score: number): DiscoveryConfidence {
  if (score >= 14) return 'high';
  if (score >= 8) return 'medium';
  return 'low';
}

function candidateFor(metric: GuidedBusinessMetric, resource: DiscoveredResource, column: DiscoveredColumn) {
  const resourceScore = indexScore(resource.name, resourceHints[metric]);
  const namedValueScore = indexScore(column.name, valueHints[metric]);
  const genericKeyScore = metric !== 'revenue' && resourceScore && (column.primaryKey || /(?:^|_)id$/.test(normalized(column.name))) ? 3 : 0;
  const valueScore = Math.max(namedValueScore, genericKeyScore);
  if (metric === 'revenue') {
    if (!valueScore || (!resourceScore && !/(?:amount|total|revenue|price)/.test(normalized(column.name)))) return null;
  } else if (!resourceScore || !valueScore) return null;
  const dateColumn = dateHints[metric].map((hint) => resource.columns.find((item) => normalized(item.name) === hint)?.name).find(Boolean);
  if (metric !== 'active_subscriptions' && !dateColumn) return null;
  const filterColumn = metric === 'active_subscriptions'
    ? statusHints.map((hint) => resource.columns.find((item) => normalized(item.name) === hint)?.name).find(Boolean)
    : (metric === 'revenue' || metric === 'orders')
      ? statusHints.map((hint) => resource.columns.find((item) => normalized(item.name) === hint)?.name).find(Boolean)
      : undefined;
  if (metric === 'active_subscriptions' && !filterColumn) return null;
  const score = resourceScore * 2 + valueScore * 2 + (dateColumn ? 3 : 0) + (filterColumn ? 3 : 0);
  const cents = metric === 'revenue' && /(?:_cents|_minor|_pennies)$/.test(normalized(column.name));
  return {
    score,
    mapping: {
      metric,
      resource: resource.name,
      valueColumn: column.name,
      ...(dateColumn ? { dateColumn } : {}),
      ...(filterColumn ? { filterColumn, filterValues: metric === 'active_subscriptions' ? activeStatusValues : successfulPaymentStatusValues } : {}),
      ...(cents ? { scale: 0.01 } : {}),
      confidence: confidenceFor(score),
      reason: `${resource.name}.${column.name}`,
    } satisfies GuidedMetricMapping,
  };
}

export function suggestBusinessMetrics(resources: DiscoveredResource[]): GuidedMetricSuggestion[] {
  return guidedBusinessMetrics.map((metric) => {
    const candidates = resources.flatMap((resource) => resource.columns.flatMap((column) => {
      const candidate = candidateFor(metric, resource, column);
      return candidate ? [candidate] : [];
    })).sort((a, b) => b.score - a.score || a.mapping.reason.localeCompare(b.mapping.reason));
    const unique = new Map<string, GuidedMetricMapping>();
    for (const candidate of candidates) if (!unique.has(candidate.mapping.reason)) unique.set(candidate.mapping.reason, candidate.mapping);
    return { metric, options: [...unique.values()].slice(0, 8) };
  });
}

export function validateGuidedMappings(resources: DiscoveredResource[], mappings: GuidedMetricMapping[]) {
  const suggestions = new Map(suggestBusinessMetrics(resources).map((suggestion) => [suggestion.metric, suggestion.options]));
  const seen = new Set<GuidedBusinessMetric>();
  return mappings.map((mapping) => {
    if (!guidedBusinessMetrics.includes(mapping.metric) || seen.has(mapping.metric)) throw new Error('Each guided business metric may be mapped once.');
    seen.add(mapping.metric);
    const candidate = suggestions.get(mapping.metric)?.find((option) => option.resource === mapping.resource
      && option.valueColumn === mapping.valueColumn
      && option.dateColumn === mapping.dateColumn
      && option.filterColumn === mapping.filterColumn);
    if (!candidate) {
      throw new Error(`The selected field ${mapping.resource}.${mapping.valueColumn} is no longer available.`);
    }
    return candidate;
  });
}

export function guidedMetricLabel(metric: GuidedBusinessMetric, zh = false) {
  const labels: Record<GuidedBusinessMetric, [string, string]> = {
    revenue: ['Revenue', '收入'],
    orders: ['Orders', '订单'],
    signups: ['New users', '新增用户'],
    active_subscriptions: ['Active subscriptions', '活跃订阅'],
  };
  return labels[metric][zh ? 1 : 0];
}
