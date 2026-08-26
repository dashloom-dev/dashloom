export type SpecialistPreset = 'portfolio_analyst' | 'revenue_analyst' | 'seo_growth_analyst' | 'operations_analyst' | 'client_reporting_analyst';

const specialistDomains: Partial<Record<SpecialistPreset, ReadonlySet<string>>> = {
  revenue_analyst: new Set(['commercial']),
  seo_growth_analyst: new Set(['acquisition', 'search']),
  operations_analyst: new Set(['delivery', 'operations']),
};

export function agentSpecialistDomains(preset: SpecialistPreset) { return [...(specialistDomains[preset] || [])]; }

export function agentMetricAllowed(preset: SpecialistPreset, allowedMetrics: readonly string[], metric: string, domain: string | null) {
  if (preset === 'operations_analyst' && metric.startsWith('queue_')) return true;
  if (!allowedMetrics.length || allowedMetrics.includes(metric)) return true;
  return Boolean(domain && specialistDomains[preset]?.has(domain));
}
