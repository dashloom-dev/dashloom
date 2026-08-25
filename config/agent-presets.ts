export const agentPresets = [
  {
    id: 'portfolio-analyst',
    name: 'Portfolio Analyst',
    purpose: 'Ranks product opportunities and explains portfolio-level changes.',
    requiredSignals: ['traffic', 'revenue', 'operations'],
  },
  {
    id: 'revenue-analyst',
    name: 'Revenue Analyst',
    purpose: 'Explains recurring revenue, churn, retention, and expansion movements.',
    requiredSignals: ['subscriptions', 'payments', 'customers'],
  },
  {
    id: 'seo-growth-analyst',
    name: 'SEO Growth Analyst',
    purpose: 'Finds query, page, ranking, and competitor opportunities.',
    requiredSignals: ['gsc', 'analytics', 'competitors'],
  },
  {
    id: 'operations-analyst',
    name: 'Operations Analyst',
    purpose: 'Detects traffic, error, latency, and infrastructure anomalies.',
    requiredSignals: ['cloudflare', 'd1', 'deployments'],
  },
  {
    id: 'client-reporting-analyst',
    name: 'Client Reporting Analyst',
    purpose: 'Produces evidence-linked summaries across client workspaces.',
    requiredSignals: ['client-kpis', 'delivery', 'changes'],
  },
] as const;
