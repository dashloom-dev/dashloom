import { agentAllowedMetrics, type AgentPreset } from './agent-catalog.ts';
import { assessActionOutcome, metricOutcomeDirection } from './agent-action-outcome-policy.ts';
import { agentMetricAllowed } from './agent-metric-policy.ts';

export type RadarTone = 'risk' | 'opportunity' | 'watch';
export type RadarSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

type RadarSeries = {
  productId: string;
  productName: string;
  source: string;
  metric: string;
  currency: string | null;
  domain?: string | null;
  current: number;
  previous: number;
  changePercent: number | null;
  latestDate: string;
  evidenceId: string;
};

type RadarRelationship = {
  evidenceId: string;
  productId: string;
  productName: string;
  pattern: 'same_direction' | 'diverging';
  left: Omit<RadarSeries, 'latestDate'> & { latestDate?: string; category: string };
  right: Omit<RadarSeries, 'latestDate'> & { latestDate?: string; category: string };
  evidenceRefs: [string, string];
  caution: string;
  score: number;
};

type RadarHealth = { evidenceId: string; productId: string; productName: string; score: number; status: 'healthy' | 'watch' | 'risk' | 'no_data'; reasons: string[]; freshness: string | null };
type RadarGoal = { evidenceId: string; productId: string; productName: string; name: string; metric: string; source: string | null; currency: string | null; targetValue: number; currentValue: number | null; progressPercent: number | null; status: 'no_data' | 'achieved' | 'at_risk' | 'off_track'; period: string; periodStart: string; periodEnd: string };
type RadarMission = { evidenceId: string; id: string; productId: string | null; productName: string | null; title: string; metric: string; source: string; currency: string | null; baselineValue: number; targetValue: number; latestValue: number | null; progressPercent: number | null; status: string; assessment: string; dueAt: string; limitation: string };

export type RadarEvidence = {
  periods: { current: { start: string; end: string }; previous: { start: string; end: string } };
  products: Array<{ id: string; name: string }>;
  series: RadarSeries[];
  crossSignals?: RadarRelationship[];
  healthScores?: RadarHealth[];
  goals?: RadarGoal[];
  missions?: RadarMission[];
  freshness: string | null;
};

export type AgentRadarSignal = {
  id: string;
  kind: 'metric_change' | 'cross_signal' | 'health' | 'goal' | 'mission';
  tone: RadarTone;
  severity: RadarSeverity;
  preset: AgentPreset;
  productId: string | null;
  productName: string;
  title: string;
  detail: string;
  metric: string | null;
  source: string | null;
  currency: string | null;
  currentValue: number | null;
  previousValue: number | null;
  changePercent: number | null;
  latestDate: string | null;
  evidenceRefs: string[];
  limitation: string;
  question: string;
  score: number;
};

const specialistOrder: AgentPreset[] = ['revenue_analyst', 'seo_growth_analyst', 'operations_analyst'];

export function radarSpecialist(metric: string, domain: string | null = null): AgentPreset {
  return specialistOrder.find((preset) => agentMetricAllowed(preset, agentAllowedMetrics(preset), metric, domain)) || 'portfolio_analyst';
}

function label(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function percent(value: number | null) { return value === null ? 'an unbounded amount' : `${Math.abs(value).toFixed(1)}%`; }
function movement(value: number | null) { return value === null ? 'changed' : value >= 0 ? 'increased' : 'decreased'; }
function signalQuestion(title: string, detail: string, refs: string[]) { return `Analyze this Signal Radar item: ${title}. Observed evidence: ${detail} Cite ${refs.join(' and ')} when making material claims, separate facts from hypotheses, and recommend the smallest measurable next action.`.slice(0, 1000); }
function scored(signal: Omit<AgentRadarSignal, 'question'>): AgentRadarSignal { return { ...signal, question: signalQuestion(signal.title, signal.detail, signal.evidenceRefs) }; }

function metricSignals(evidence: RadarEvidence, thresholdPercent: number) {
  return evidence.series.flatMap((item): AgentRadarSignal[] => {
    if (item.changePercent === null || !Number.isFinite(item.changePercent) || Math.abs(item.changePercent) < thresholdPercent) return [];
    const assessment = assessActionOutcome(metricOutcomeDirection(item.metric), item.previous, item.current, 1);
    const tone: RadarTone = assessment === 'regressed' ? 'risk' : assessment === 'improved' ? 'opportunity' : 'watch';
    const magnitude = Math.abs(item.changePercent);
    const severity: RadarSeverity = tone === 'risk' ? magnitude >= 50 ? 'critical' : 'warning' : tone === 'opportunity' ? 'opportunity' : 'info';
    const metricLabel = label(item.metric);
    const title = `${metricLabel} ${movement(item.changePercent)} for ${item.productName}`;
    const detail = `${metricLabel} moved from ${item.previous.toLocaleString('en-US')} to ${item.current.toLocaleString('en-US')} (${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(1)}%) between the two complete comparison windows.`;
    return [scored({ id: `radar:${item.evidenceId}`, kind: 'metric_change', tone, severity, preset: radarSpecialist(item.metric, item.domain || null), productId: item.productId, productName: item.productName, title, detail, metric: item.metric, source: item.source, currency: item.currency, currentValue: item.current, previousValue: item.previous, changePercent: item.changePercent, latestDate: item.latestDate, evidenceRefs: [item.evidenceId], limitation: 'This is a deterministic period comparison. It identifies movement, not its cause.', score: (tone === 'risk' ? 300 : tone === 'opportunity' ? 200 : 100) + Math.min(magnitude, 100) })];
  });
}

function relationshipSignals(evidence: RadarEvidence) {
  return (evidence.crossSignals || []).slice(0, 5).map((item) => {
    const title = `${label(item.left.metric)} and ${label(item.right.metric)} are ${item.pattern === 'same_direction' ? 'moving together' : 'diverging'} for ${item.productName}`;
    const detail = `${label(item.left.metric)} ${movement(item.left.changePercent)} ${percent(item.left.changePercent)}, while ${label(item.right.metric)} ${movement(item.right.changePercent)} ${percent(item.right.changePercent)}.`;
    return scored({ id: `radar:${item.evidenceId}`, kind: 'cross_signal' as const, tone: 'watch' as const, severity: 'info' as const, preset: 'portfolio_analyst' as const, productId: item.productId, productName: item.productName, title, detail, metric: null, source: null, currency: item.left.currency || item.right.currency, currentValue: null, previousValue: null, changePercent: null, latestDate: [item.left.latestDate, item.right.latestDate].filter((value): value is string => Boolean(value)).sort().at(-1) || null, evidenceRefs: [item.evidenceId, ...item.evidenceRefs], limitation: item.caution, score: 125 + Math.min(item.score, 100) });
  });
}

function healthSignals(evidence: RadarEvidence) {
  return (evidence.healthScores || []).filter((item) => item.status === 'risk' || item.status === 'watch').map((item) => {
    const risk = item.status === 'risk';
    const title = `${item.productName} health is ${risk ? 'at risk' : 'on watch'}`;
    const detail = `${item.score}/100 deterministic health score. ${item.reasons.slice(0, 2).join(' ')}`;
    return scored({ id: `radar:${item.evidenceId}`, kind: 'health' as const, tone: risk ? 'risk' as const : 'watch' as const, severity: risk && item.score < 35 ? 'critical' as const : 'warning' as const, preset: 'operations_analyst' as const, productId: item.productId, productName: item.productName, title, detail, metric: null, source: null, currency: null, currentValue: item.score, previousValue: null, changePercent: null, latestDate: item.freshness, evidenceRefs: [item.evidenceId], limitation: 'Health is a deterministic summary of freshness and operating signals, not a model opinion.', score: risk ? 420 - item.score : 250 - item.score });
  });
}

function goalSignals(evidence: RadarEvidence) {
  return (evidence.goals || []).filter((item) => item.status !== 'achieved').map((item) => {
    const tone: RadarTone = item.status === 'no_data' ? 'watch' : 'risk';
    const title = item.status === 'no_data' ? `${item.productName} goal has no matching evidence` : `${item.productName} is ${item.status === 'off_track' ? 'off track' : 'at risk'} on ${item.name}`;
    const detail = item.currentValue === null ? `${label(item.metric)} has no matching data for the ${item.period} goal window.` : `${label(item.metric)} is ${item.currentValue.toLocaleString('en-US')} against a ${item.targetValue.toLocaleString('en-US')} target (${item.progressPercent?.toFixed(1) || '0.0'}%).`;
    return scored({ id: `radar:${item.evidenceId}`, kind: 'goal' as const, tone, severity: item.status === 'off_track' ? 'warning' as const : 'info' as const, preset: radarSpecialist(item.metric), productId: item.productId, productName: item.productName, title, detail, metric: item.metric, source: item.source, currency: item.currency, currentValue: item.currentValue, previousValue: item.targetValue, changePercent: item.progressPercent, latestDate: item.periodEnd, evidenceRefs: [item.evidenceId], limitation: 'Goal status is calculated from the operator-defined target and matching rolling-period evidence.', score: item.status === 'off_track' ? 360 : item.status === 'at_risk' ? 280 : 170 });
  });
}

function missionSignals(evidence: RadarEvidence) {
  return (evidence.missions || []).filter((item) => ['off_track', 'missed', 'insufficient'].includes(item.assessment)).map((item) => {
    const missed = item.assessment === 'missed';
    const title = `${item.productName || 'Workspace'} mission is ${item.assessment.replaceAll('_', ' ')}`;
    const detail = `${item.title}: ${item.latestValue === null ? 'no later measurement' : `${label(item.metric)} is ${item.latestValue.toLocaleString('en-US')}`} against a ${item.targetValue.toLocaleString('en-US')} target${item.progressPercent === null ? '' : ` (${item.progressPercent.toFixed(1)}% progress)`}.`;
    return scored({ id: `radar:${item.evidenceId}`, kind: 'mission' as const, tone: 'risk' as const, severity: missed ? 'critical' as const : 'warning' as const, preset: radarSpecialist(item.metric), productId: item.productId, productName: item.productName || 'Workspace', title, detail, metric: item.metric, source: item.source, currency: item.currency, currentValue: item.latestValue, previousValue: item.targetValue, changePercent: item.progressPercent, latestDate: item.dueAt.slice(0, 10), evidenceRefs: [item.evidenceId], limitation: item.limitation, score: missed ? 460 : item.assessment === 'off_track' ? 380 : 300 });
  });
}

export function buildAgentRadar(evidence: RadarEvidence, options: { thresholdPercent?: number; limit?: number } = {}) {
  const thresholdPercent = Math.max(1, Math.min(100, options.thresholdPercent || 10));
  const limit = Math.max(1, Math.min(100, options.limit || 30));
  const signals = [...metricSignals(evidence, thresholdPercent), ...relationshipSignals(evidence), ...healthSignals(evidence), ...goalSignals(evidence), ...missionSignals(evidence)].sort((left, right) => right.score - left.score || left.id.localeCompare(right.id)).slice(0, limit);
  return {
    generatedAt: new Date().toISOString(),
    freshness: evidence.freshness,
    periods: evidence.periods,
    productCount: evidence.products.length,
    seriesCount: evidence.series.length,
    signals,
    counts: {
      risk: signals.filter((item) => item.tone === 'risk').length,
      opportunity: signals.filter((item) => item.tone === 'opportunity').length,
      watch: signals.filter((item) => item.tone === 'watch').length,
    },
  };
}
