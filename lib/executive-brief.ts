import { agentDefinitions, type AgentPreset } from './agent-catalog.ts';

export const executivePresetOrder: AgentPreset[] = ['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst'];

export type ExecutiveFinding = {
  title: string;
  detail: string;
  severity: 'info' | 'opportunity' | 'warning' | 'critical';
  metric: string | null;
  productId: string | null;
  currentValue: number | null;
  previousValue: number | null;
  changePercent: number | null;
  action: string;
  confidence: number;
  evidenceRefs: string[];
};
export type ExecutiveSpecialistResult = { preset: AgentPreset; runId: string; summary: string; findings: ExecutiveFinding[] };

const severityRank = { critical: 0, warning: 1, opportunity: 2, info: 3 } as const;

export function selectExecutivePresets(input: { requested: AgentPreset[]; readiness: Record<AgentPreset, { ready: boolean }>; capacity: number }) {
  const requested = [...new Set(input.requested)].filter((preset) => executivePresetOrder.includes(preset));
  const unavailable = requested.filter((preset) => !input.readiness[preset]?.ready);
  const selected = requested.filter((preset) => input.readiness[preset]?.ready).sort((left, right) => executivePresetOrder.indexOf(left) - executivePresetOrder.indexOf(right));
  if (requested.length < 2) return { selected: [], unavailable, code: 'AT_LEAST_TWO_SPECIALISTS' as const };
  if (unavailable.length) return { selected: [], unavailable, code: 'SPECIALIST_NOT_READY' as const };
  if (selected.length > input.capacity) return { selected: [], unavailable: [], code: 'INSUFFICIENT_AI_CAPACITY' as const };
  return { selected, unavailable: [], code: null };
}

function identity(finding: ExecutiveFinding) {
  const normalizedTitle = finding.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim();
  return `${finding.productId || 'workspace'}:${finding.metric || 'general'}:${normalizedTitle}`;
}

export function buildExecutiveDigest(results: ExecutiveSpecialistResult[]) {
  const candidates = results.flatMap((result) => result.findings.map((finding, findingIndex) => ({ ...finding, preset: result.preset, agent: agentDefinitions[result.preset].name, analysisRunId: result.runId, findingIndex })));
  candidates.sort((left, right) => severityRank[left.severity] - severityRank[right.severity] || right.confidence - left.confidence || left.title.localeCompare(right.title));
  const seen = new Set<string>();
  const priorities = candidates.filter((finding) => { const key = identity(finding); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 10);
  const criticalCount = candidates.filter((finding) => finding.severity === 'critical').length;
  const warningCount = candidates.filter((finding) => finding.severity === 'warning').length;
  const opportunityCount = candidates.filter((finding) => finding.severity === 'opportunity').length;
  const top = priorities[0];
  const summary = `${results.length} specialist${results.length === 1 ? '' : 's'} completed with ${criticalCount} critical, ${warningCount} warning, and ${opportunityCount} opportunity finding${criticalCount + warningCount + opportunityCount === 1 ? '' : 's'}.${top ? ` Highest priority: ${top.title}` : ''}`;
  return {
    schemaVersion: 1,
    summary,
    counts: { specialists: results.length, findings: candidates.length, critical: criticalCount, warning: warningCount, opportunity: opportunityCount, info: candidates.filter((finding) => finding.severity === 'info').length },
    specialists: results.map((result) => ({ preset: result.preset, agent: agentDefinitions[result.preset].name, analysisRunId: result.runId, summary: result.summary, findingCount: result.findings.length })),
    priorities,
  };
}
