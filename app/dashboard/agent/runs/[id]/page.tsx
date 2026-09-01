import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { analysisRuns } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';

type EvidenceItem = { evidenceId: string };
type Evidence = {
  generatedAt: string;
  agentPreset: string;
  request?: { question?: string };
  periods: { current: { start: string; end: string }; previous: { start: string; end: string } };
  freshness: string | null;
  pointCount: number;
  skills?: Array<{ slug: string; version: string; name: string; instructionHash?: string; policyVersion?: number }>;
  series: Array<EvidenceItem & { productName: string; source: string; metric: string; currency?: string | null; current: number; previous: number; changePercent: number | null; latestDate: string }>;
  competitors: Array<EvidenceItem & { competitorName: string; domain: string | null; metric: string; metricDate: string; value: number; source: string }>;
  competitorTrends?: Array<EvidenceItem & { competitorName: string; source: string; metric: string; currency: string | null; current: number; previous: number; changePercent: number | null; latestDate: string }>;
  crossSignals?: Array<EvidenceItem & { productName: string; pattern: string; caution: string; evidenceRefs: [string, string]; left: { source: string; metric: string; changePercent: number }; right: { source: string; metric: string; changePercent: number } }>;
  healthScores?: Array<EvidenceItem & { productName: string; score: number; status: string; reasons: string[]; freshness: string | null }>;
  goals?: Array<EvidenceItem & { productName: string; name: string; metric: string; source: string | null; currency: string | null; direction: string; period: string; targetValue: number; currentValue: number | null; progressPercent: number | null; status: string; periodStart: string; periodEnd: string }>;
  missions?: Array<EvidenceItem & { productName: string | null; title: string; hypothesis: string; metric: string; source: string; currency: string | null; baselineValue: number; baselineDate: string; targetValue: number; latestValue: number | null; latestDate: string | null; progressPercent: number; status: string; assessment: string; dueAt: string; limitation: string }>;
  images?: Array<EvidenceItem & { label: string; mimeType: string; byteSize: number; sha256: string }>;
};
type Findings = { summary: string; findings: Array<{ title: string; detail: string; severity: string; action: string; confidence: number; evidenceRefs: string[] }> };
const imageSizeUnit = 'KB';
const imageRetentionLabel = 'original image not retained';
const visualEvidenceLabel = 'visual evidence';

export default async function AnalysisAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const { id } = await params;
  if (!workspace) notFound();
  const [run] = await getDb().select().from(analysisRuns).where(and(eq(analysisRuns.id, id), eq(analysisRuns.workspaceId, workspace.id))).limit(1);
  if (!run) notFound();
  let evidence: Evidence;
  let findings: Findings | null = null;
  try {
    evidence = JSON.parse(run.evidenceJson) as Evidence;
    findings = run.findingsJson ? JSON.parse(run.findingsJson) as Findings : null;
  } catch {
    return <div className="empty-state"><h1>Evidence unavailable</h1><p>This run contains an invalid historical snapshot.</p></div>;
  }
  const references = new Set(findings?.findings.flatMap((finding) => finding.evidenceRefs || []) || []);
  const cited = <T extends EvidenceItem>(items: T[] | undefined) => (items || []).filter((item) => references.has(item.evidenceId));
  const series = cited(evidence.series);
  const competitors = cited(evidence.competitors);
  const competitorTrends = cited(evidence.competitorTrends);
  const crossSignals = cited(evidence.crossSignals);
  const healthScores = cited(evidence.healthScores);
  const goals = cited(evidence.goals);
  const missions = cited(evidence.missions);
  const images = cited(evidence.images);
  const citedCount = series.length + competitors.length + competitorTrends.length + crossSignals.length + healthScores.length + goals.length + missions.length + images.length;

  return <div className="app-page">
    <header className="app-page-head"><div><span>ANALYSIS AUDIT</span><h1>Frozen evidence</h1><p>{evidence.request?.question || 'Historical scheduled analysis'} · generated {new Date(evidence.generatedAt).toLocaleString()}</p></div><a className="app-secondary" href="/dashboard/agent">Back to Agent</a></header>
    <section className="real-metric-grid"><article><span>Status</span><strong>{run.status}</strong><small>{run.trigger} trigger</small></article><article><span>Evidence points</span><strong>{evidence.pointCount}</strong><small>fresh through {evidence.freshness || 'unknown'}</small></article><article><span>Current period</span><strong>{evidence.periods.current.end}</strong><small>{evidence.periods.current.start} onward</small></article><article><span>Model tokens</span><strong>{run.inputTokens + run.outputTokens}</strong><small>{run.inputTokens} in · {run.outputTokens} out</small></article></section>
    {findings && <section className="app-panel view-evidence"><div className="panel-title"><div><span>VALIDATED OUTPUT</span><h2>{findings.summary}</h2></div><span className="status-pill">{findings.findings.length} findings</span></div>{findings.findings.map((finding, index) => <article className="audit-finding" key={index}><strong>{finding.title}</strong><p>{finding.detail}</p><small>{finding.action} · confidence {Math.round(finding.confidence * 100)}%</small><div className="finding-evidence">{finding.evidenceRefs.map((reference) => <code key={reference}>{reference}</code>)}</div></article>)}</section>}
    <section className="app-panel view-evidence"><div className="panel-title"><div><span>CITED EVIDENCE</span><h2>Facts used by material claims</h2></div><span className="status-pill">{citedCount} cited records</span></div>
      {images.map((item) => <article className="evidence-row" key={item.evidenceId}><div><strong>{item.label}</strong><small>{item.evidenceId}</small></div><span>{item.mimeType} · {imageRetentionLabel}</span><b>{Math.max(1, Math.ceil(item.byteSize / 1024))} {imageSizeUnit}</b><em>{visualEvidenceLabel}</em></article>)}
      {missions.map((item) => <article className="evidence-row" key={item.evidenceId}><div><strong>{item.productName || 'Removed product'} · {item.title}</strong><small>{item.evidenceId}</small></div><span>{item.metric} · {item.source} · due {item.dueAt.slice(0, 10)} · {item.limitation}</span><b>{item.latestValue === null ? '—' : item.latestValue} / {item.targetValue}</b><em>{item.assessment} · {item.progressPercent.toFixed(1)}%</em></article>)}
      {goals.map((item) => <article className="evidence-row" key={item.evidenceId}><div><strong>{item.productName} · {item.name}</strong><small>{item.evidenceId}</small></div><span>{item.metric}{item.source ? ` · ${item.source}` : ''}{item.currency ? ` · ${item.currency.toUpperCase()}` : ''} · rolling {item.period} · {item.periodStart}–{item.periodEnd}</span><b>{item.currentValue === null ? '—' : item.currentValue} / {item.targetValue}</b><em>{item.status}{item.progressPercent === null ? '' : ` · ${item.progressPercent.toFixed(1)}%`}</em></article>)}
      {crossSignals.map((item) => <article className="evidence-row" key={item.evidenceId}><div><strong>{item.productName}</strong><small>{item.evidenceId}</small></div><span>{item.left.source}.{item.left.metric} {signed(item.left.changePercent)} · {item.right.source}.{item.right.metric} {signed(item.right.changePercent)} · {item.caution}</span><b>{item.pattern.replace('_', ' ')}</b><em>relationship</em></article>)}
      {healthScores.map((item) => <article className="evidence-row" key={item.evidenceId}><div><strong>{item.productName}</strong><small>{item.evidenceId}</small></div><span>{item.reasons.join(' ')}</span><b>{item.score}/100</b><em>{item.status}</em></article>)}
      {series.map((item) => <article className="evidence-row" key={item.evidenceId}><div><strong>{item.productName}</strong><small>{item.evidenceId}</small></div><span>{item.source}{item.currency ? ` · ${item.currency.toUpperCase()}` : ''} · {item.latestDate}</span><b>{item.current}</b><em>{item.changePercent === null ? '—' : signed(item.changePercent)}</em></article>)}
      {competitorTrends.map((item) => <article className="evidence-row" key={item.evidenceId}><div><strong>{item.competitorName}</strong><small>{item.evidenceId}</small></div><span>{item.source} · {item.metric} · {item.latestDate}{item.currency ? ` · ${item.currency.toUpperCase()}` : ''}</span><b>{item.current}</b><em>{item.changePercent === null ? '—' : signed(item.changePercent)}</em></article>)}
      {competitors.map((item) => <article className="evidence-row" key={item.evidenceId}><div><strong>{item.competitorName}</strong><small>{item.evidenceId}</small></div><span>{item.source} · {item.metricDate}</span><b>{item.value}</b><em>competitor</em></article>)}
      {!citedCount && <div className="panel-empty"><p>No cited evidence records were found in this historical snapshot.</p></div>}
    </section>
    {evidence.skills?.length ? <p className="context-note">Installed skills: {evidence.skills.map((skill) => `${skill.name} (${skill.slug}@${skill.version}${skill.instructionHash ? ` · sha256:${skill.instructionHash.slice(0, 12)}` : ''}${skill.policyVersion ? ` · policy v${skill.policyVersion}` : ''})`).join(', ')}</p> : null}
  </div>;
}

function signed(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`; }
