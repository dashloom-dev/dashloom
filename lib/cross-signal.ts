export type ComparableSeries = { productId: string; productName: string; source: string; metric: string; currency: string | null; current: number; previous: number; changePercent: number | null; evidenceId: string; categoryHint?: string | null };

const categories: Array<[string, (metric: string) => boolean]> = [
  ['commercial', (metric) => ['revenue', 'mrr', 'arr', 'refunds', 'chargebacks', 'paid_transactions', 'subscription_transactions', 'paid_users', 'paid_customers', 'trialing_customers', 'churn_rate', 'retention_rate'].includes(metric)],
  ['acquisition', (metric) => ['active_users', 'users', 'sessions', 'signups', 'conversions', 'clicks'].includes(metric)],
  ['search', (metric) => ['impressions', 'ctr', 'position', 'organic_users'].includes(metric)],
  ['delivery', (metric) => metric.startsWith('repo_') || metric.startsWith('vercel_') || metric.startsWith('pages_')],
  ['operations', (metric) => metric.startsWith('queue_') || metric.startsWith('supabase_') || metric.startsWith('r2_') || ['requests', 'errors', 'error_rate', 'subrequests', 'wall_time', 'cpu_time_p50', 'cpu_time_p99', 'd1_reads', 'd1_writes'].includes(metric)],
];

function category(metric: string) { return categories.find(([, match]) => match(metric))?.[0] || null; }
function hash(value: string) { let result = 2166136261; for (let index = 0; index < value.length; index += 1) { result ^= value.charCodeAt(index); result = Math.imul(result, 16777619); } return (result >>> 0).toString(36); }
function relationshipId(value: string) { return `relationship:${hash(value)}${hash([...value].reverse().join(''))}`; }

export function buildCrossSignals(series: ComparableSeries[], thresholdPercent = 10, limit = 20) {
  const candidates = series.filter((item) => item.changePercent !== null && Number.isFinite(item.changePercent) && Math.abs(item.changePercent) >= thresholdPercent).map((item) => ({ ...item, category: item.categoryHint || category(item.metric) })).filter((item): item is typeof item & { category: string } => Boolean(item.category));
  const pairs: Array<{ evidenceId: string; productId: string; productName: string; pattern: 'same_direction' | 'diverging'; left: ComparableSeries & { category: string }; right: ComparableSeries & { category: string }; evidenceRefs: [string, string]; caution: string; score: number }> = [];
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) { const left = candidates[leftIndex]; const right = candidates[rightIndex]; if (left.productId !== right.productId || left.category === right.category) continue; if (left.currency && right.currency && left.currency !== right.currency) continue; const identity = [left.productId, left.evidenceId, right.evidenceId].sort().join('|'); pairs.push({ evidenceId: relationshipId(identity), productId: left.productId, productName: left.productName, pattern: Math.sign(left.changePercent!) === Math.sign(right.changePercent!) ? 'same_direction' : 'diverging', left, right, evidenceRefs: [left.evidenceId, right.evidenceId], caution: 'This is deterministic co-movement evidence, not proof that either signal caused the other.', score: Math.abs(left.changePercent!) + Math.abs(right.changePercent!) }); }
  return pairs.sort((a, b) => b.score - a.score).slice(0, Math.max(0, limit));
}
