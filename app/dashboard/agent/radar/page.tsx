import { Activity, ArrowRight, Bot, CircleAlert, CircleCheckBig, RadioTower, Sparkles } from 'lucide-react';
import { buildEvidence } from '@/lib/agent';
import { agentDefinitions, type AgentPreset } from '@/lib/agent-catalog';
import { buildAgentRadar } from '@/lib/agent-radar';
import { getWorkspaceAgentReadiness, getWorkspaceAgentReadinessByProduct } from '@/lib/agent-readiness';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { getDb } from '@/db';
import { aiProviderAccounts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { RadarAnalyzeButton } from './radar-analyze-button';

function metricValue(value: number | null, currency: string | null) {
  if (value === null) return '—';
  if (currency) try { return Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(value); } catch { /* explicit numeric fallback */ }
  return Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export default async function AgentRadarPage() {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  if (!workspace) return <div className="empty-state"><h1>Workspace setup needs attention</h1><p>No active workspace is available.</p></div>;
  const [evidence, readiness, providers] = await Promise.all([
    buildEvidence(workspace.id, 'portfolio_analyst', 'weekly'),
    getWorkspaceAgentReadiness(workspace.id),
    getDb().select({ id: aiProviderAccounts.id }).from(aiProviderAccounts).where(and(eq(aiProviderAccounts.workspaceId, workspace.id), eq(aiProviderAccounts.status, 'connected'))).limit(1),
  ]);
  const radar = buildAgentRadar(evidence);
  const readinessByProduct = await getWorkspaceAgentReadinessByProduct(workspace.id, radar.signals.map((signal) => signal.productId).filter((productId): productId is string => Boolean(productId)));
  const modelReady = providers.length > 0;
  const canAnalyze = ['owner', 'admin', 'member'].includes(workspace.role);
  const resolvedPreset = (preset: AgentPreset, productId: string | null) => { const scoped = productId ? readinessByProduct[productId] || readiness : readiness; return modelReady && scoped[preset].ready ? preset : modelReady && scoped.portfolio_analyst.ready ? 'portfolio_analyst' : preset; };

  return <div className="app-page radar-page">
    <header className="app-page-head"><div><span>AGENT SIGNAL RADAR</span><h1>See what changed before you ask.</h1><p>Dashloom turns current synced product evidence into a ranked decision queue. Detection is deterministic; an Agent is called only when you choose to investigate.</p></div><a className="app-secondary" href="/dashboard/agent">Open Agent</a></header>
    <section className="radar-summary">
      <article data-tone="risk"><CircleAlert /><span>Needs attention</span><strong>{radar.counts.risk}</strong><small>Regressions, target gaps, and unhealthy products</small></article>
      <article data-tone="opportunity"><Sparkles /><span>Opportunities</span><strong>{radar.counts.opportunity}</strong><small>Material movement in a favorable direction</small></article>
      <article data-tone="watch"><Activity /><span>Watch signals</span><strong>{radar.counts.watch}</strong><small>Contextual movement and non-causal relationships</small></article>
      <article><RadioTower /><span>Evidence coverage</span><strong>{radar.seriesCount}</strong><small>{radar.productCount} real product{radar.productCount === 1 ? '' : 's'} · latest {radar.freshness || 'not synced'}</small></article>
    </section>
    <section className="radar-window app-panel"><div><div><span>COMPLETE COMPARISON WINDOWS</span><strong>{radar.periods.current.start} – {radar.periods.current.end}</strong></div><ArrowRight /><div><span>COMPARED WITH</span><strong>{radar.periods.previous.start} – {radar.periods.previous.end}</strong></div></div><p>Signals refresh from stored aggregate evidence after synchronization. Partial current-day flows are excluded, currencies stay separate, and no signal is presented as causal proof.</p></section>
    {!radar.productCount || !radar.seriesCount ? <section className="app-panel radar-empty"><RadioTower size={30} /><h2>Connect a real product to activate Signal Radar.</h2><p>Create the product you actually operate, map at least one source, and run synchronization. Dashloom will not fill this queue with demo evidence.</p><div><a className="app-primary" href="/dashboard/products">Add product</a><a className="app-secondary" href="/dashboard/sources">Connect source</a></div></section> : !radar.signals.length ? <section className="app-panel radar-empty"><CircleCheckBig size={30} /><h2>No material signal crossed the 10% radar threshold.</h2><p>Your evidence is connected and current enough to compare. The queue stays empty instead of inventing work when movement is immaterial.</p><a className="app-secondary" href="/dashboard/agent">Ask a broader question</a></section> : <section className="radar-signal-list" aria-label="Prioritized product signals">{radar.signals.map((signal, index) => {
      const preset = resolvedPreset(signal.preset, signal.productId);
      const scopedReadiness = signal.productId ? readinessByProduct[signal.productId] || readiness : readiness;
      const ready = modelReady && scopedReadiness[preset].ready;
      const targetContext = signal.kind === 'goal' || signal.kind === 'mission';
      return <article className="radar-signal" data-tone={signal.tone} data-severity={signal.severity} key={signal.id}>
        <header><div><span>#{String(index + 1).padStart(2, '0')} · {signal.kind.replaceAll('_', ' ').toUpperCase()}</span><h2>{signal.title}</h2></div><b>{signal.tone}</b></header>
        <p>{signal.detail}</p>
        {signal.metric && <div className="radar-values"><span><small>{targetContext ? 'Target' : 'Previous'}</small><strong>{metricValue(signal.previousValue, signal.currency)}</strong></span><ArrowRight /><span><small>{signal.kind === 'mission' ? 'Latest' : 'Current'}</small><strong>{metricValue(signal.currentValue, signal.currency)}</strong></span>{signal.changePercent !== null && <em>{targetContext ? `${signal.changePercent.toFixed(1)}% progress` : `${signal.changePercent >= 0 ? '+' : ''}${signal.changePercent.toFixed(1)}%`}</em>}</div>}
        <div className="radar-provenance"><span>{signal.productName}</span>{signal.source && <span>{signal.source}</span>}{signal.latestDate && <span>evidence {signal.latestDate}</span>}{signal.evidenceRefs.map((reference) => <code key={reference}>{reference}</code>)}</div>
        <footer><div><strong><Bot size={16} /> {agentDefinitions[preset].name}</strong><small>{signal.limitation}{preset !== signal.preset ? ' The Portfolio Analyst is used because the preferred specialist is not ready.' : ''} Analysis is locked to {signal.productId ? 'this product' : 'the workspace'}.</small></div><RadarAnalyzeButton preset={preset} question={signal.question} productId={signal.productId} ready={ready} canAnalyze={canAnalyze} /></footer>
      </article>;
    })}</section>}
    {!modelReady && radar.seriesCount > 0 && <section className="app-panel radar-model-needed"><Bot size={24} /><div><h2>Your signals are ready; the analysis model is not.</h2><p>Connect your own OpenAI-compatible provider. Signal detection remains available without an LLM.</p></div><a className="app-primary" href="/dashboard/agent">Connect model</a></section>}
  </div>;
}
