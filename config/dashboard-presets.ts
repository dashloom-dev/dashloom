export const dashboardPresets = [
  {
    id: 'indie-hacker',
    name: 'Indie Hacker Dashboard',
    audience: 'Solo builders with multiple products',
    signals: ['portfolio health', 'revenue movement', 'traffic', 'shipping velocity'],
    agent: 'Portfolio Analyst',
  },
  {
    id: 'saas-revenue',
    name: 'SaaS Revenue Dashboard',
    audience: 'Subscription and usage-based SaaS teams',
    signals: ['MRR', 'ARR', 'churn', 'retention', 'expansion'],
    agent: 'Revenue Analyst',
  },
  {
    id: 'seo-growth',
    name: 'SEO Growth Dashboard',
    audience: 'Content-led products and SEO teams',
    signals: ['clicks', 'impressions', 'rankings', 'pages', 'competitors'],
    agent: 'SEO Growth Analyst',
  },
  {
    id: 'cloudflare-operations',
    name: 'Cloudflare Operations Dashboard',
    audience: 'Teams operating products on Cloudflare',
    signals: ['requests', 'errors', 'latency', 'D1', 'Workers'],
    agent: 'Operations Analyst',
  },
  {
    id: 'agency-client',
    name: 'Agency Client Dashboard',
    audience: 'Agencies managing multiple client workspaces',
    signals: ['client KPIs', 'delivery status', 'anomalies', 'reports'],
    agent: 'Client Reporting Analyst',
  },
] as const;
