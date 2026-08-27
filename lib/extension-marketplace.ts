import { agentSkillManifestSchema, compareSemanticVersions, type AgentSkillManifest } from './agent-skill-validation.ts';

export type MarketplaceSkill = {
  kind: 'agent_skill';
  slug: string;
  summary: string;
  publisher: string;
  sourceUrl: string;
  review: { status: 'maintainer_reviewed'; policyVersion: number; reviewedAt: string };
  manifest: AgentSkillManifest;
};

export type MarketplaceConnector = {
  kind: 'connector'; slug: string; name: string; summary: string; publisher: string; status: 'built_in'; href: string; signals: string[];
};

const sourceUrl = 'https://github.com/dashloom-dev/dashloom/blob/main/lib/extension-marketplace.ts';
const review = { status: 'maintainer_reviewed' as const, policyVersion: 1, reviewedAt: '2026-08-26' };

export const marketplaceSkills: MarketplaceSkill[] = [
  {
    kind: 'agent_skill', slug: 'portfolio-allocation-radar', publisher: 'Dashloom', sourceUrl, review,
    summary: 'Ranks a multi-product portfolio by evidence-backed momentum, risk, and the next allocation decision.',
    manifest: agentSkillManifestSchema.parse({ slug: 'portfolio-allocation-radar', name: 'Portfolio Allocation Radar', version: '1.0.0', basePreset: 'portfolio_analyst', requiredMetrics: ['active_users', 'revenue', 'requests'], instructions: 'Compare products on recent momentum, freshness, and operational risk. Recommend where to investigate, maintain, or reduce attention. Keep unlike currencies separate and label every allocation judgment as a recommendation.' }),
  },
  {
    kind: 'agent_skill', slug: 'saas-unit-economics', publisher: 'Dashloom', sourceUrl, review,
    summary: 'Turns revenue, paid-user, churn, and acquisition signals into a disciplined SaaS operating brief.',
    manifest: agentSkillManifestSchema.parse({ slug: 'saas-unit-economics', name: 'SaaS Unit Economics', version: '1.0.0', basePreset: 'revenue_analyst', requiredMetrics: ['mrr', 'churn_rate', 'paid_users'], instructions: 'Prioritize sustainable recurring revenue, paid-user movement, and churn risk. Separate currencies, distinguish stocks from flows, and state when acquisition or cost evidence is missing before discussing unit economics.' }),
  },
  {
    kind: 'agent_skill', slug: 'seo-content-opportunity', publisher: 'Dashloom', sourceUrl, review,
    summary: 'Finds search demand and ranking movements that deserve a concrete content or technical SEO action.',
    manifest: agentSkillManifestSchema.parse({ slug: 'seo-content-opportunity', name: 'SEO Content Opportunity', version: '1.0.0', basePreset: 'seo_growth_analyst', requiredMetrics: ['gsc_clicks', 'gsc_impressions', 'gsc_position'], instructions: 'Prioritize material search visibility changes and opportunities supported by clicks, impressions, and position evidence. Separate observed movement from hypotheses about cause, and propose one measurable content or technical follow-up.' }),
  },
  {
    kind: 'agent_skill', slug: 'cloudflare-reliability-watch', publisher: 'Dashloom', sourceUrl, review,
    summary: 'Correlates customer-facing request, error, compute, database, and storage evidence without inventing causes.',
    manifest: agentSkillManifestSchema.parse({ slug: 'cloudflare-reliability-watch', name: 'Cloudflare Reliability Watch', version: '1.1.0', basePreset: 'operations_analyst', requiredMetrics: ['requests', 'errors', 'cpu_time'], instructions: 'Prioritize customer-impacting reliability changes across request volume, error movement, compute pressure, database activity, and storage signals. Treat co-movement as non-causal and recommend a bounded verification step.' }),
  },
  {
    kind: 'agent_skill', slug: 'agency-executive-brief', publisher: 'Dashloom', sourceUrl, review,
    summary: 'Produces a concise client-ready narrative that preserves evidence, uncertainty, and ownership.',
    manifest: agentSkillManifestSchema.parse({ slug: 'agency-executive-brief', name: 'Agency Executive Brief', version: '1.0.0', basePreset: 'client_reporting_analyst', requiredMetrics: [], instructions: 'Write for a client stakeholder: lead with business outcome, then explain material evidence, risk, and the next owned action. Avoid internal implementation detail unless it affects the decision, and state evidence gaps plainly.' }),
  },
];

export const marketplaceConnectors: MarketplaceConnector[] = [
  { kind: 'connector', slug: 'google-growth', name: 'Google Growth', publisher: 'Dashloom', status: 'built_in', href: '/dashboard/sources', summary: 'Use OAuth with PKCE to discover and map GA4 and Search Console properties.', signals: ['GA4', 'Search Console'] },
  { kind: 'connector', slug: 'bing-search', name: 'Bing Search', publisher: 'Dashloom', status: 'built_in', href: '/dashboard/sources', summary: 'Discover verified Bing Webmaster sites and compare search, query, and page performance.', signals: ['Bing Webmaster', 'Queries', 'Pages'] },
  { kind: 'connector', slug: 'd1-business-data', name: 'D1 Business Data', publisher: 'Dashloom', status: 'built_in', href: '/dashboard/sources', summary: 'Read validated aggregate business metrics from a dedicated Cloudflare D1 query.', signals: ['Users', 'Orders', 'Subscriptions', 'Revenue'] },
  { kind: 'connector', slug: 'merchant-revenue', name: 'Merchant Revenue', publisher: 'Dashloom', status: 'built_in', href: '/dashboard/sources', summary: 'Normalize gross, refunded, recurring, and paid-customer evidence without combining currencies.', signals: ['Stripe', 'Lemon Squeezy', 'Creem', 'Polar', 'Paddle'] },
  { kind: 'connector', slug: 'custom-evidence', name: 'Custom Evidence', publisher: 'Dashloom', status: 'built_in', href: '/dashboard/settings', summary: 'Bring product-specific aggregates through safe pull or authenticated normalized ingestion.', signals: ['Custom REST', 'Ingestion API', 'Connector SDK'] },
];

export function findMarketplaceSkill(slug: string) { return marketplaceSkills.find((skill) => skill.slug === slug) || null; }

export type MarketplaceInstallState = 'available' | 'active' | 'disabled' | 'update' | 'newer' | 'conflict';
export function getMarketplaceInstallState(manifest: AgentSkillManifest, installed?: { version: string; name: string; basePreset: string; instructions: string; requiredMetricsJson: string; enabled: boolean } | null): MarketplaceInstallState {
  if (!installed) return 'available';
  const comparison = compareSemanticVersions(installed.version, manifest.version);
  if (comparison > 0) return 'newer';
  if (comparison < 0) return 'update';
  const exactCatalogManifest = installed.name === manifest.name && installed.basePreset === manifest.basePreset && installed.instructions === manifest.instructions && installed.requiredMetricsJson === JSON.stringify(manifest.requiredMetrics);
  if (!exactCatalogManifest) return 'conflict';
  return installed.enabled ? 'active' : 'disabled';
}
