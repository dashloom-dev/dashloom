import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { agentComparisonResults, agentComparisonRuns } from '@/db/schema';
import { evidenceAgreement } from '@/lib/agent-comparison-evaluation';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';

type Findings = { summary: string; findings: Array<{ title: string; detail: string; severity: string; action: string; confidence: number; evidenceRefs: string[] }> };
type Evaluation = { citationValidation: string; findingCount: number; citedEvidenceCount: number; availableEvidenceCount: number; evidenceRefs: string[]; actionableFindings: number; averageConfidence: number; severities: Record<string, number> };
type Evidence = { pointCount?: number; freshness?: string | null; periods?: { current?: { start?: string; end?: string }; previous?: { start?: string; end?: string } }; truncated?: { metrics?: boolean; competitors?: boolean }; skills?: Array<{ slug: string; version: string; instructionHash?: string }> };

export default async function ComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const { id } = await params;
  if (!workspace) notFound();
  const [comparison] = await getDb().select().from(agentComparisonRuns).where(and(eq(agentComparisonRuns.id, id), eq(agentComparisonRuns.workspaceId, workspace.id))).limit(1);
  if (!comparison) notFound();
  const rows = await getDb().select().from(agentComparisonResults).where(and(eq(agentComparisonResults.comparisonRunId, id), eq(agentComparisonResults.workspaceId, workspace.id)));
  let evidence: Evidence = {};
  try { evidence = JSON.parse(comparison.evidenceJson) as Evidence; } catch { /* Historical corruption is rendered as unavailable metadata. */ }
  const parsed = rows.map((row) => {
    let findings: Findings | null = null;
    let evaluation: Evaluation | null = null;
    try { findings = row.findingsJson ? JSON.parse(row.findingsJson) as Findings : null; evaluation = row.evaluationJson ? JSON.parse(row.evaluationJson) as Evaluation : null; } catch { findings = null; evaluation = null; }
    return { row, findings, evaluation };
  });
  const successful = parsed.filter((item) => item.row.status === 'success' && item.evaluation);
  const pairs = successful.flatMap((left, index) => successful.slice(index + 1).map((right) => ({ left: left.row.providerName, right: right.row.providerName, agreement: evidenceAgreement(left.evaluation!.evidenceRefs, right.evaluation!.evidenceRefs) })));

  return <div className="app-page">
    <header className="app-page-head"><div><span>AGENT QUALITY LAB · {comparison.status.toUpperCase()}</span><h1>Versioned model comparison</h1><p>{comparison.question}</p></div><a className="app-secondary" href="/dashboard/agent">Back to Agent</a></header>
    <section className="real-metric-grid"><article><span>Providers</span><strong>{comparison.providerCount}</strong><small>{successful.length} contract-valid results</small></article><article><span>Prompt version</span><strong>{comparison.promptVersion}</strong><small>identical system contract</small></article><article><span>Frozen evidence</span><strong>{evidence.pointCount || 0}</strong><small>fresh through {evidence.freshness || 'unknown'}</small></article><article><span>Coverage</span><strong>{evidence.truncated?.metrics || evidence.truncated?.competitors ? 'Partial' : 'Complete'}</strong><small>{evidence.periods?.current?.start || '—'} – {evidence.periods?.current?.end || '—'}</small></article></section>
    {pairs.length ? <section className="app-panel agreement-panel"><div className="panel-title"><div><span>EVIDENCE AGREEMENT</span><h2>What the models chose to cite</h2></div></div>{pairs.map((pair) => <article key={`${pair.left}:${pair.right}`}><span>{pair.left} ↔ {pair.right}</span><b>{pair.agreement === null ? '—' : `${Math.round(pair.agreement * 100)}%`}</b><small>Jaccard overlap of cited evidence IDs</small></article>)}</section> : null}
    <section className="comparison-results">{parsed.map(({ row, findings, evaluation }) => <article className="comparison-result" key={row.id}><header><div><span>{row.providerName}</span><h2>{row.model}</h2></div><b data-status={row.status}>{row.status}</b></header><div className="comparison-stats"><span><b>{row.latencyMs ? `${(row.latencyMs / 1000).toFixed(1)}s` : '—'}</b><small>latency</small></span><span><b>{row.inputTokens + row.outputTokens}</b><small>tokens</small></span><span><b>{evaluation?.citedEvidenceCount ?? '—'}</b><small>cited facts</small></span><span><b>{evaluation ? `${Math.round(evaluation.averageConfidence * 100)}%` : '—'}</b><small>model confidence</small></span></div>{row.status === 'error' ? <div className="panel-empty"><p>This provider did not return a contract-valid, citation-valid result. No unvalidated text was retained.</p></div> : findings && evaluation ? <><div className="comparison-summary"><strong>{findings.summary}</strong><small>{evaluation.actionableFindings}/{evaluation.findingCount} actionable · citations {evaluation.citationValidation}</small></div>{findings.findings.map((finding, index) => <div className="finding" data-severity={finding.severity} key={index}><strong>{finding.title}</strong><p>{finding.detail}</p><small>Next: {finding.action} · model confidence {Math.round(finding.confidence * 100)}%</small></div>)}</> : <div className="panel-empty"><p>Stored result data is unavailable.</p></div>}<footer><small>{row.providerMode} · prompt {row.promptVersion} · started {new Date(row.startedAt).toLocaleString()}</small></footer></article>)}</section>
    <p className="context-note">Latency, token counts, and model-reported confidence are observational. Evidence overlap measures cited-fact agreement, not semantic correctness. Compare outputs against the frozen evidence before changing a production model.</p>
  </div>;
}
