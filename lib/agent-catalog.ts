import { agentMetricAllowed } from './agent-metric-policy.ts';

export const agentDefinitions = {
  portfolio_analyst: { name: 'Portfolio Analyst', dashboard: 'indie_hacker', focus: 'Compare product traction, acquisition, revenue, and customer-facing operations. Rank the few opportunities and risks that most deserve an independent builder’s attention.', metrics: [] as string[] },
  revenue_analyst: { name: 'Revenue Analyst', dashboard: 'saas_revenue', focus: 'Analyze MRR, revenue, paid and subscription-linked transactions, customers, trials, churn, retention, expansion, refunds, chargebacks, and conversion. Never infer accounting causes not present in evidence.', metrics: ['mrr', 'arr', 'revenue', 'paid_transactions', 'subscription_transactions', 'paid_users', 'paid_customers', 'trialing_customers', 'churn_rate', 'retention_rate', 'expansion_revenue', 'refunds', 'chargebacks', 'signups', 'paid_signups'] },
  seo_growth_analyst: { name: 'SEO Growth Analyst', dashboard: 'seo_growth', focus: 'Find query and page opportunities from clicks, impressions, CTR, position, sessions, and approved competitor evidence. Separate ranking movement from traffic movement.', metrics: ['clicks', 'impressions', 'ctr', 'position', 'sessions', 'organic_users', 'conversions'] },
  operations_analyst: { name: 'Operations Analyst', dashboard: 'cloudflare_operations', focus: 'Detect customer-facing request, error, latency, CPU, queue, database, and object-storage regressions. Prioritize measurable user impact and reversible checks; do not treat deployment counts or repository activity as business outcomes.', metrics: ['requests', 'errors', 'error_rate', 'subrequests', 'wall_time', 'cpu_time_p50', 'cpu_time_p99', 'd1_reads', 'd1_writes', 'r2_requests', 'r2_errors', 'r2_payload_bytes', 'r2_metadata_bytes', 'r2_objects', 'r2_pending_uploads'] },
  client_reporting_analyst: { name: 'Client Reporting Analyst', dashboard: 'agency_client', focus: 'Produce client-safe performance explanations across acquisition, commercial, SEO, and operational evidence. Use plain language and clearly separate wins, risks, and next actions.', metrics: [] as string[] },
} as const;

export type AgentPreset = keyof typeof agentDefinitions;

export const queueOperationMetrics = ['queue_backlog_messages', 'queue_backlog_bytes', 'queue_oldest_message_age_seconds', 'queue_delivery_paused'] as const;
export function agentAllowedMetrics(preset: AgentPreset): readonly string[] { return preset === 'operations_analyst' ? [...agentDefinitions[preset].metrics, ...queueOperationMetrics] : agentDefinitions[preset].metrics; }

const customDomains = new Set(['commercial', 'acquisition', 'search', 'delivery', 'operations', 'product']);

export function customMetricDomain(source: string, dimensionsJson: string) {
  if (source !== 'custom') return null;
  try {
    const value = JSON.parse(dimensionsJson) as { domain?: unknown };
    return typeof value.domain === 'string' && customDomains.has(value.domain) ? value.domain : null;
  } catch { return null; }
}

export type ReadinessMetricRow = { metric: string; source: string; dimensionsJson?: string; domain?: string | null; metricDate: string; pointCount?: number };
export type AgentReadiness = { ready: boolean; eligiblePointCount: number; metricCount: number; sourceCount: number; latestDate: string | null; competitorPointCount: number };

export function summarizeAgentReadiness(rows: ReadinessMetricRow[], competitorRows: ReadinessMetricRow[] = []): Record<AgentPreset, AgentReadiness> {
  return Object.fromEntries((Object.keys(agentDefinitions) as AgentPreset[]).map((preset) => {
    const allowed = agentAllowedMetrics(preset);
    const eligible = rows.filter((row) => agentMetricAllowed(preset, allowed, row.metric, row.domain ?? customMetricDomain(row.source, row.dimensionsJson || '{}')));
    const eligibleCompetitors = competitorRows.filter((row) => agentMetricAllowed(preset, allowed, row.metric, row.domain ?? customMetricDomain(row.source, row.dimensionsJson || '{}')));
    const eligiblePointCount = eligible.reduce((total, row) => total + (row.pointCount || 1), 0);
    const competitors = eligibleCompetitors.reduce((total, row) => total + (row.pointCount || 1), 0);
    return [preset, { ready: eligiblePointCount + competitors > 0, eligiblePointCount, metricCount: new Set(eligible.map((row) => row.metric)).size, sourceCount: new Set(eligible.map((row) => row.source)).size, latestDate: [...eligible, ...eligibleCompetitors].map((row) => row.metricDate).sort().at(-1) || null, competitorPointCount: competitors }];
  })) as Record<AgentPreset, AgentReadiness>;
}
