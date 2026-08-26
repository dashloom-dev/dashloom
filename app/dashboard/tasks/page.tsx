import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentConversations, agentProfiles, aiProviderAccounts, analysisRuns, products } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { agentDefinitions, type AgentPreset } from '@/lib/agent-catalog';
import { agentScopeLabel } from '@/lib/agent-scope';
import { agentTaskDuration, agentTaskRetry, parseAnalysisRequestQuestion } from '@/lib/agent-task-center';
import { TaskRetryButton } from './task-retry-button';

export default async function AgentTasksPage() {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  if (!workspace) return <div className="empty-state"><h1>Workspace required</h1><p>Create or join a workspace before viewing Agent tasks.</p></div>;

  const [runs, profiles, conversations, productRows, providers] = await Promise.all([
    getDb().select().from(analysisRuns).where(eq(analysisRuns.workspaceId, workspace.id)).orderBy(desc(analysisRuns.createdAt)).limit(50),
    getDb().select({ id: agentProfiles.id, name: agentProfiles.name, preset: agentProfiles.preset }).from(agentProfiles).where(eq(agentProfiles.workspaceId, workspace.id)),
    getDb().select().from(agentConversations).where(eq(agentConversations.workspaceId, workspace.id)),
    getDb().select({ id: products.id, name: products.name }).from(products).where(eq(products.workspaceId, workspace.id)),
    getDb().select({ status: aiProviderAccounts.status, mode: aiProviderAccounts.mode }).from(aiProviderAccounts).where(eq(aiProviderAccounts.workspaceId, workspace.id)),
  ]);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  const productIds = new Set(productRows.map((product) => product.id));
  const counts = Object.fromEntries(['queued', 'running', 'success', 'error', 'cancelled'].map((status) => [status, runs.filter((run) => run.status === status).length]));
  const byokReady = providers.some((provider) => provider.status === 'connected');

  return <div className="app-page agent-task-center">
    <header className="app-page-head"><div><span>AGENT OPERATIONS</span><h1>Task center</h1><p>Track analysis queue state, execution, failures, token use, and safe retry eligibility in this deployment.</p></div><a className="app-secondary" href="/dashboard/agent">Start analysis</a></header>
    <section className="task-summary" aria-label="Agent task summary">
      <article><span>Queued + running</span><strong>{counts.queued + counts.running}</strong><small>{counts.queued} queued · {counts.running} running</small></article>
      <article><span>Failed</span><strong>{counts.error + counts.cancelled}</strong><small>{counts.error} errors · {counts.cancelled} cancelled</small></article>
      <article><span>Model capacity</span><strong>{byokReady ? 'BYOK' : 'Setup'}</strong><small>{byokReady ? 'connected provider available' : 'connect a provider'}</small></article>
    </section>
    <section className="task-list app-panel">
      <div className="panel-title"><div><span>RECENT EXECUTION</span><h2>Latest 50 analysis tasks</h2></div><span className="status-pill">workspace scoped</span></div>
      {runs.map((run) => {
        const profile = profileById.get(run.agentProfileId);
        const conversation = run.conversationId ? conversationById.get(run.conversationId) : undefined;
        const question = parseAnalysisRequestQuestion(run.evidenceJson);
        const scopeAvailable = !conversation?.productId || productIds.has(conversation.productId);
        const retry = agentTaskRetry({ status: run.status, question, conversationId: run.conversationId, conversationActive: conversation?.status === 'active', scopeAvailable });
        const preset = (profile?.preset || conversation?.agentPreset || 'portfolio_analyst') as AgentPreset;
        const scope = conversation ? agentScopeLabel({ mode: conversation.scopeMode, productId: conversation.productId }, productRows) : 'Workspace';
        return <article className="task-row" key={run.id} data-status={run.status}>
          <header><div><span>{profile?.name || agentDefinitions[preset].name}</span><h2>{question || conversation?.title || `${run.trigger} analysis`}</h2></div><b data-status={run.status}>{run.status}</b></header>
          <div className="task-meta"><span>{scope} scope</span><span>{run.trigger} trigger</span><span>{run.inputTokens + run.outputTokens} tokens</span><span>{agentTaskDuration(run.startedAt, run.finishedAt) || 'Not started'}</span><span>{new Date(run.createdAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: workspace.timezone })}</span></div>
          <footer><div><strong>{retry.label}</strong><small>{retry.reason}{run.errorCode ? ` Error code: ${run.errorCode}.` : ''}</small></div><div className="task-actions"><a href={`/dashboard/agent/runs/${run.id}`}>Inspect evidence</a>{conversation?.status === 'active' && <a href={`/dashboard/agent?conversation=${conversation.id}`}>Open conversation</a>}{retry.state === 'available' && question && run.conversationId && <TaskRetryButton question={question} preset={preset} conversationId={run.conversationId} productId={conversation?.productId || null} />}</div></footer>
        </article>;
      })}
      {!runs.length && <div className="panel-empty"><p>No Agent task has run in this workspace yet.</p><a href="/dashboard/agent">Start the first analysis →</a></div>}
    </section>
  </div>;
}
