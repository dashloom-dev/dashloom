import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentActionOutcomes, agentActions, agentGrowthMissions, products, user, workspaceMembers } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { ActionControls } from './action-controls';
import { BackfillActions } from './backfill-actions';
import { OutcomeRefresh } from './outcome-refresh';
import { MissionLaunch } from './mission-launch';
import Link from 'next/link';

const statuses = ['suggested', 'planned', 'in_progress', 'done', 'dismissed'] as const;

export default async function AgentActionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { user: currentUser } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(currentUser.id);
  if (!workspace) return null;
  const query = await searchParams;
  const selected = statuses.includes(query.status as typeof statuses[number]) ? query.status as typeof statuses[number] : null;
  const [actions, members, outcomes, missionCycles] = await Promise.all([
    getDb().select({ action: agentActions, productName: products.name }).from(agentActions).leftJoin(products, eq(agentActions.productId, products.id)).where(selected ? and(eq(agentActions.workspaceId, workspace.id), eq(agentActions.status, selected)) : and(eq(agentActions.workspaceId, workspace.id), inArray(agentActions.status, ['suggested', 'planned', 'in_progress']))).orderBy(sql`case ${agentActions.severity} when 'critical' then 1 when 'warning' then 2 when 'opportunity' then 3 else 4 end`, desc(agentActions.lastSeenAt)).limit(200),
    getDb().select({ userId: workspaceMembers.userId, name: user.name, email: user.email }).from(workspaceMembers).innerJoin(user, eq(workspaceMembers.userId, user.id)).where(eq(workspaceMembers.workspaceId, workspace.id)),
    getDb().select({ outcome: agentActionOutcomes, actionTitle: agentActions.title, productName: products.name }).from(agentActionOutcomes).innerJoin(agentActions, eq(agentActionOutcomes.actionId, agentActions.id)).leftJoin(products, eq(agentActionOutcomes.productId, products.id)).where(eq(agentActionOutcomes.workspaceId, workspace.id)).orderBy(desc(agentActionOutcomes.completedAt)).limit(20),
    getDb().select({ actionId: agentGrowthMissions.sourceActionId, occurrenceCount: agentGrowthMissions.sourceActionOccurrenceCount }).from(agentGrowthMissions).where(eq(agentGrowthMissions.workspaceId, workspace.id)),
  ]);
  const launchedCycles = new Set(missionCycles.map((mission) => `${mission.actionId}:${mission.occurrenceCount}`));
  const canUpdate = ['owner', 'admin', 'member'].includes(workspace.role);
  return <div className="app-page">
    <header className="app-page-head"><div><span>OPEN TASKS</span><h1>Decide what to do next.</h1><p>AI report items appear here when they need an owner. Assign someone, set a due date, or dismiss an item that is not useful.</p></div><div className="action-head-controls"><Link className="app-primary" href="/dashboard/agent">Create report</Link><Link className="app-secondary" href="/dashboard/missions">View follow-ups</Link><BackfillActions enabled={canUpdate} /><OutcomeRefresh enabled={canUpdate} /></div></header>
    <section className="app-panel action-outcomes"><div className="panel-title"><div><span>AFTER COMPLETION</span><h2>What changed after finished tasks</h2></div><span className="status-pill">{outcomes.length} recent checks</span></div><p className="comparison-intro">Dashloom compares the selected number before and after a task was completed. This shows timing, not proof that the task caused the change.</p><div className="action-outcome-grid">{outcomes.map(({ outcome, actionTitle, productName }) => <article key={outcome.id} data-assessment={outcome.assessment}><header><span>{outcome.assessment.toUpperCase()}</span><small>{productName || 'All products'} · completed {outcome.completedAt.slice(0, 10)}</small></header><h3>{actionTitle}</h3>{outcome.metric && outcome.baselineValue !== null ? <p><strong>{outcome.metric}</strong> · {outcome.baselineValue.toLocaleString()} on {outcome.baselineDate}{outcome.latestValue !== null ? ` → ${outcome.latestValue.toLocaleString()} on ${outcome.latestDate}` : ' · waiting for newer data'}</p> : <p>This task does not have a product number to compare yet.</p>}<footer><small>{outcome.changePercent === null ? outcome.limitation : `${outcome.changePercent >= 0 ? '+' : ''}${outcome.changePercent.toFixed(1)}% · ${outcome.limitation}`}</small>{outcome.sourceAnalysisRunId && <a className="analysis-audit-link" href={`/dashboard/agent/runs/${outcome.sourceAnalysisRunId}`}>View original report →</a>}</footer></article>)}{!outcomes.length && <div className="panel-empty"><p>Finish a task with a product number attached. Dashloom will compare that number again when newer data arrives.</p></div>}</div></section>
    <nav className="action-filters"><Link href="/dashboard/actions">Open</Link>{statuses.map((status) => <Link href={`/dashboard/actions?status=${status}`} key={status}>{status.replaceAll('_', ' ')}</Link>)}</nav>
    <section className="agent-action-list">{actions.map(({ action, productName }) => <article className="agent-action-card" key={action.id} data-severity={action.severity}><header><div><span>{action.severity.toUpperCase()} · {productName || 'ALL PRODUCTS'} · SEEN {action.occurrenceCount}×</span><h2>{action.title}</h2></div><b data-status={action.status}>{action.status.replaceAll('_', ' ')}</b></header><p>{action.detail}</p><div className="action-recommendation"><strong>Suggested task</strong><p>{action.recommendedAction}</p></div><footer><small>AI confidence {Math.round(action.confidence * 100)}% · last seen {new Date(action.lastSeenAt).toLocaleString()}</small>{action.sourceAnalysisRunId && <a className="analysis-audit-link" href={`/dashboard/agent/runs/${action.sourceAnalysisRunId}`}>View report and data →</a>}</footer>{canUpdate && <><MissionLaunch actionId={action.id} actionTitle={action.title} recommendedAction={action.recommendedAction} members={members} launched={launchedCycles.has(`${action.id}:${action.occurrenceCount}`)} /><ActionControls action={action} members={members} /></>}</article>)}{!actions.length && <div className="panel-empty"><p>No tasks match this filter. Create a new AI report after syncing product data.</p><a href="/dashboard/agent">Create report</a></div>}</section>
  </div>;
}
