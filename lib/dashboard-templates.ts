import { z } from 'zod';

export const dashboardTemplates = {
  indie_hacker: { eyebrow: 'INDIE HACKER DASHBOARD', title: 'Portfolio command center', copy: 'Compare product traction, revenue, delivery, and infrastructure signals without opening five separate tools.', metrics: ['active_users', 'revenue', 'requests', 'clicks', 'repo_stars', 'repo_commits'], agent: 'Portfolio Analyst', agentPreset: 'portfolio_analyst' },
  saas_revenue: { eyebrow: 'SAAS REVENUE DASHBOARD', title: 'Revenue and retention', copy: 'Track the commercial health of each SaaS product and expose movement that needs an operator decision.', metrics: ['mrr', 'revenue', 'paid_customers', 'paid_transactions', 'subscription_transactions', 'refunds', 'chargebacks', 'churn_rate'], agent: 'Revenue Analyst', agentPreset: 'revenue_analyst' },
  seo_growth: { eyebrow: 'SEO GROWTH DASHBOARD', title: 'Search demand and competitors', copy: 'Bring Search Console and competitor observations into one query and page performance view.', metrics: ['clicks', 'impressions', 'ctr', 'position'], agent: 'SEO Growth Analyst', agentPreset: 'seo_growth_analyst' },
  cloudflare_operations: { eyebrow: 'INFRASTRUCTURE OPERATIONS', title: 'Infrastructure and delivery health', copy: 'Monitor Cloudflare runtime, queues, storage and Pages deployments alongside Vercel delivery and Supabase backend evidence.', metrics: ['requests', 'errors', 'cpu_time_p99', 'queue_backlog_messages', 'queue_oldest_message_age_seconds', 'queue_delivery_paused', 'r2_errors', 'pages_failed_deployments'], agent: 'Operations Analyst', agentPreset: 'operations_analyst' },
  agency_client: { eyebrow: 'AGENCY CLIENT DASHBOARD', title: 'Client-ready performance', copy: 'Keep every client product isolated while preparing evidence-linked recurring summaries.', metrics: ['active_users', 'revenue', 'clicks', 'requests'], agent: 'Client Reporting Analyst', agentPreset: 'client_reporting_analyst' },
} as const;

export type DashboardPreset = keyof typeof dashboardTemplates;
export const dashboardPresetSchema = z.enum(['indie_hacker', 'saas_revenue', 'seo_growth', 'cloudflare_operations', 'agency_client']);
export const dashboardConfigurationSchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  copy: z.string().trim().max(300).optional(),
  metrics: z.array(z.string().trim().regex(/^[a-z][a-z0-9_]{0,63}$/)).min(1).max(8).optional(),
}).strict();

export type DashboardConfiguration = z.infer<typeof dashboardConfigurationSchema>;

export function parseDashboardConfiguration(value: string): DashboardConfiguration {
  try { return dashboardConfigurationSchema.parse(JSON.parse(value)); } catch { return {}; }
}

export function publicDashboardCopy(origin: 'manual' | 'agent', configuredCopy: string | undefined, templateCopy: string) {
  return origin === 'agent' ? templateCopy : configuredCopy || templateCopy;
}
