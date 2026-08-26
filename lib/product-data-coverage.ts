import type { AgentReadiness, AgentPreset } from './agent-catalog';

export type ProductMappingCoverage = { productId: string; source: string; enabled: boolean; accountStatus: 'pending' | 'connected' | 'attention' | 'disabled' };
export type ProductEvidenceCoverage = { productId: string; source: string; pointCount: number; metricCount: number; latestDate: string };
export type SourceCoverageState = 'fresh' | 'stale' | 'awaiting_sync' | 'attention';

export function buildProductDataCoverage(input: { productId: string; mappings: ProductMappingCoverage[]; evidence: ProductEvidenceCoverage[]; readiness: Record<AgentPreset, AgentReadiness>; now?: Date }) {
  const now = input.now || new Date();
  const mappings = input.mappings.filter((item) => item.productId === input.productId);
  const evidence = input.evidence.filter((item) => item.productId === input.productId);
  const sources = [...new Set([...mappings.map((item) => item.source), ...evidence.map((item) => item.source)])].sort().map((source) => {
    const sourceMappings = mappings.filter((item) => item.source === source);
    const sourceEvidence = evidence.filter((item) => item.source === source);
    const latestDate = sourceEvidence.map((item) => item.latestDate).sort().at(-1) || null;
    const ageDays = latestDate ? Math.max(0, Math.floor((now.getTime() - new Date(`${latestDate}T00:00:00Z`).getTime()) / 86400000)) : null;
    const enabled = sourceMappings.some((item) => item.enabled);
    const connected = sourceMappings.some((item) => item.enabled && item.accountStatus === 'connected');
    const state: SourceCoverageState = latestDate ? ageDays! <= 3 ? 'fresh' : 'stale' : connected ? 'awaiting_sync' : 'attention';
    return { source, state, mapped: enabled, connected, pointCount: sourceEvidence.reduce((total, item) => total + item.pointCount, 0), metricCount: sourceEvidence.reduce((total, item) => total + item.metricCount, 0), latestDate, ageDays };
  });
  const latestDate = evidence.map((item) => item.latestDate).sort().at(-1) || null;
  const status = sources.some((item) => item.state === 'fresh') ? 'live' : evidence.length ? 'stale' : mappings.length ? 'awaiting_sync' : 'not_connected';
  return {
    status,
    sources,
    sourceCount: sources.length,
    liveSourceCount: sources.filter((item) => item.state === 'fresh').length,
    pointCount: evidence.reduce((total, item) => total + item.pointCount, 0),
    metricCount: evidence.reduce((total, item) => total + item.metricCount, 0),
    latestDate,
    readyAgents: (Object.entries(input.readiness) as Array<[AgentPreset, AgentReadiness]>).filter(([, item]) => item.ready).map(([preset]) => preset),
  };
}
