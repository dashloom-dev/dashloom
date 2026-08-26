import type { AgentResult } from './agent.ts';
import { agentDefinitions, type AgentPreset } from './agent-catalog.ts';
import { dashboardConfigurationSchema, dashboardTemplates, type DashboardPreset } from './dashboard-templates.ts';

const presetMap: Record<AgentPreset, DashboardPreset> = {
  portfolio_analyst: 'indie_hacker',
  revenue_analyst: 'saas_revenue',
  seo_growth_analyst: 'seo_growth',
  operations_analyst: 'cloudflare_operations',
  client_reporting_analyst: 'agency_client',
};

export function buildAgentDashboardDefinition(preset: AgentPreset, result: AgentResult, createdAt: string) {
  const dashboardPreset = presetMap[preset];
  const template = dashboardTemplates[dashboardPreset];
  const findingMetrics = result.findings.flatMap((finding) => finding.metric && /^[a-z][a-z0-9_]{0,63}$/.test(finding.metric) ? [finding.metric] : []);
  const metrics = [...new Set([...findingMetrics, ...template.metrics])].slice(0, 8);
  const scopedProducts = [...new Set(result.findings.flatMap((finding) => finding.productId ? [finding.productId] : []))];
  const everyFindingIsProductScoped = result.findings.every((finding) => Boolean(finding.productId));
  const date = createdAt.slice(0, 10);
  return {
    preset: dashboardPreset,
    name: `${agentDefinitions[preset].name} · ${date}`.slice(0, 80),
    productId: everyFindingIsProductScoped && scopedProducts.length === 1 ? scopedProducts[0] : null,
    configuration: dashboardConfigurationSchema.parse({
      title: `${agentDefinitions[preset].name} briefing`,
      copy: result.summary.slice(0, 300),
      metrics,
    }),
  };
}
