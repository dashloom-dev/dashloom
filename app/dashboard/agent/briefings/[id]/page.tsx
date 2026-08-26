import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { agentExecutiveBriefs, products } from '@/db/schema';
import type { AgentPreset } from '@/lib/agent-catalog';
import type { ExecutiveFinding } from '@/lib/executive-brief';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { agentScopeLabel } from '@/lib/agent-scope';

type Priority = ExecutiveFinding & { preset: AgentPreset; agent: string; analysisRunId: string; findingIndex: number };
type Digest = { schemaVersion: number; summary: string; counts: { specialists: number; findings: number; critical: number; warning: number; opportunity: number; info: number }; specialists: Array<{ preset: AgentPreset; agent: string; analysisRunId: string; summary: string; findingCount: number }>; priorities: Priority[] };

export default async function ExecutiveBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const { id } = await params;
  if (!workspace) notFound();
  const [brief] = await getDb().select().from(agentExecutiveBriefs).where(and(eq(agentExecutiveBriefs.id, id), eq(agentExecutiveBriefs.workspaceId, workspace.id))).limit(1);
  if (!brief) notFound();
  const productRows = await getDb().select({ id: products.id, name: products.name }).from(products).where(eq(products.workspaceId, workspace.id));
  const scopeLabel = agentScopeLabel({ mode: brief.scopeMode, productId: brief.productId }, productRows);
  let digest: Digest | null = null;
  let failures: Array<{ preset: string; code: string }> = [];
  try { digest = brief.digestJson ? JSON.parse(brief.digestJson) as Digest : null; failures = JSON.parse(brief.failuresJson) as typeof failures; } catch { /* malformed historical output remains visibly unavailable */ }

  return <div className="app-page executive-brief-page">
    <header className="app-page-head"><div><span>EXECUTIVE BRIEF · {scopeLabel.toUpperCase()}</span><h1>{digest?.summary || 'The coordinated brief did not produce a usable digest.'}</h1><p>{brief.question} · {scopeLabel} evidence · started {new Date(brief.startedAt).toLocaleString()}</p></div><a className="app-secondary" href="/dashboard/agent">Back to Agent</a></header>
    <section className="real-metric-grid"><article><span>Status</span><strong>{brief.status}</strong><small>failure-isolated orchestration</small></article><article><span>Specialists</span><strong>{brief.successCount}</strong><small>{brief.failureCount} failed safely</small></article><article><span>Priorities</span><strong>{digest?.priorities.length || 0}</strong><small>deterministically ranked</small></article><article><span>Critical / warning</span><strong>{digest ? `${digest.counts.critical} / ${digest.counts.warning}` : '—'}</strong><small>across validated outputs</small></article></section>
    {digest && <><section className="app-panel executive-priorities"><div className="panel-title"><div><span>RANKED PRIORITIES</span><h2>What needs executive attention</h2></div><span className="status-pill">no synthesis model</span></div>{digest.priorities.map((priority, index) => <article key={`${priority.analysisRunId}:${priority.findingIndex}`} data-severity={priority.severity}><header><span>0{index + 1} · {priority.agent}</span><b>{Math.round(priority.confidence * 100)}%</b></header><h3>{priority.title}</h3><p>{priority.detail}</p><div><strong>Next move</strong><p>{priority.action}</p></div><footer><span>{priority.severity}{priority.metric ? ` · ${priority.metric}` : ''} · {priority.evidenceRefs.length} cited record{priority.evidenceRefs.length === 1 ? '' : 's'}</span><a href={`/dashboard/agent/runs/${priority.analysisRunId}`}>Inspect specialist evidence →</a></footer></article>)}</section>
      <section className="app-panel executive-specialist-results"><div className="panel-title"><div><span>SPECIALIST OUTPUTS</span><h2>Independent conclusions</h2></div></div>{digest.specialists.map((specialist) => <a href={`/dashboard/agent/runs/${specialist.analysisRunId}`} key={specialist.analysisRunId}><span><strong>{specialist.agent}</strong><small>{specialist.findingCount} validated findings</small></span><p>{specialist.summary}</p><b>Evidence →</b></a>)}</section></>}
    {failures.length > 0 && <section className="app-panel executive-failures"><div className="panel-title"><div><span>ISOLATED FAILURES</span><h2>Successful specialists were preserved</h2></div></div>{failures.map((failure) => <article key={failure.preset}><strong>{failure.preset.replaceAll('_', ' ')}</strong><span>{failure.code.replaceAll('_', ' ')}</span></article>)}</section>}
  </div>;
}
