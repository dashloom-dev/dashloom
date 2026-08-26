export type ProductDeletionCounts = {
  connectorMappings: number;
  metricPoints: number;
  goals: number;
  competitors: number;
  competitorMetricPoints: number;
  dashboardViews: number;
  reportSchedules: number;
  ingestionKeys: number;
  conversations: number;
  executiveBriefs: number;
  agentActions: number;
  actionOutcomes: number;
  growthMissions: number;
  reports: number;
};

export type ProductDeletionImpact = {
  deleted: Array<{ key: keyof ProductDeletionCounts; label: string; count: number }>;
  detached: Array<{ key: keyof ProductDeletionCounts; label: string; count: number }>;
  deletedTotal: number;
  detachedTotal: number;
};

const deletedLabels: Array<[keyof ProductDeletionCounts, string]> = [
  ['connectorMappings', 'connector mappings'],
  ['metricPoints', 'metric points'],
  ['goals', 'product goals'],
  ['competitors', 'tracked competitors'],
  ['competitorMetricPoints', 'competitor metric points'],
  ['dashboardViews', 'saved dashboards'],
  ['reportSchedules', 'report schedules'],
  ['ingestionKeys', 'ingestion API keys'],
];

const detachedLabels: Array<[keyof ProductDeletionCounts, string]> = [
  ['conversations', 'Agent conversations'],
  ['executiveBriefs', 'executive briefs'],
  ['agentActions', 'Agent actions'],
  ['actionOutcomes', 'action outcomes'],
  ['growthMissions', 'growth missions'],
  ['reports', 'historical reports'],
];

export function normalizeProductDomain(value: string) {
  const normalized = value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
  return normalized || null;
}

export function buildProductSlug(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';
}

export function summarizeProductDeletionImpact(counts: ProductDeletionCounts): ProductDeletionImpact {
  const deleted = deletedLabels.map(([key, label]) => ({ key, label, count: counts[key] }));
  const detached = detachedLabels.map(([key, label]) => ({ key, label, count: counts[key] }));
  return {
    deleted,
    detached,
    deletedTotal: deleted.reduce((total, item) => total + item.count, 0),
    detachedTotal: detached.reduce((total, item) => total + item.count, 0),
  };
}

export function productDeletionConfirmed(expectedName: string, confirmation: string) {
  return confirmation === expectedName;
}
