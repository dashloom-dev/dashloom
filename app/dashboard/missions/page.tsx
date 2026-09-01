import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentActions, agentGrowthMissions, products } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { MissionCancel, MissionRefresh } from './mission-controls';
import Link from 'next/link';

function formatValue(value: number | null, currency: string | null) {
  if (value === null) return 'Waiting';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${currency ? ` ${currency.toUpperCase()}` : ''}`;
}

export default async function GrowthMissionsPage() {
  const { user } = await requireServerSession(); const workspace = await getPrimaryWorkspace(user.id); if (!workspace) return null;
  const missions = await getDb().select({ mission: agentGrowthMissions, productName: products.name, actionTitle: agentActions.title }).from(agentGrowthMissions).leftJoin(products, eq(agentGrowthMissions.productId, products.id)).leftJoin(agentActions, eq(agentGrowthMissions.sourceActionId, agentActions.id)).where(eq(agentGrowthMissions.workspaceId, workspace.id)).orderBy(desc(agentGrowthMissions.createdAt)).limit(200);
  const active = missions.filter(({ mission }) => mission.status === 'active'); const finished = missions.filter(({ mission }) => mission.status !== 'active');
  const canUpdate = ['owner', 'admin', 'member'].includes(workspace.role);
  return <div className="app-page">
    <header className="app-page-head"><div><span>RESULT FOLLOW-UPS</span><h1>Check whether the number moved.</h1><p>Choose a task, save the starting value, set a target and due date, then let Dashloom update the latest value after each sync.</p></div><div className="action-head-controls"><Link className="app-primary" href="/dashboard/actions">Choose a task</Link><MissionRefresh enabled={canUpdate} /></div></header>
    <section className="mission-summary"><article><span>ACTIVE</span><strong>{active.length}</strong><small>follow-ups still running</small></article><article><span>TARGET REACHED</span><strong>{finished.filter(({ mission }) => mission.status === 'achieved').length}</strong><small>finished at or above target</small></article><article><span>CHECK NEEDED</span><strong>{finished.filter(({ mission }) => ['missed', 'insufficient'].includes(mission.status)).length}</strong><small>target missed or data missing</small></article></section>
    <section className="mission-list"><div className="panel-title"><div><span>IN PROGRESS</span><h2>Active follow-ups</h2></div><span className="status-pill">{active.length} active</span></div>{active.map(({ mission, productName, actionTitle }) => <article className="mission-card" key={mission.id} data-assessment={mission.assessment}><header><div><span>{mission.assessment.replaceAll('_', ' ').toUpperCase()} · {productName || 'REMOVED PRODUCT'}</span><h2>{mission.title}</h2></div><b>{Math.round(mission.progressPercent)}%</b></header><p>{mission.hypothesis}</p><div className="mission-track"><i style={{ width: `${Math.max(0, Math.min(100, mission.progressPercent))}%` }} /></div><div className="mission-values"><span><small>Starting value · {mission.baselineDate}</small><strong>{formatValue(mission.baselineValue, mission.currency)}</strong></span><span><small>Latest value · {mission.latestDate || 'waiting'}</small><strong>{formatValue(mission.latestValue, mission.currency)}</strong></span><span><small>Target · due {mission.dueAt.slice(0, 10)}</small><strong>{formatValue(mission.targetValue, mission.currency)}</strong></span></div><footer><small>{mission.metric} · {mission.source} · {mission.limitation}</small><div>{mission.sourceAnalysisRunId && <a className="analysis-audit-link" href={`/dashboard/agent/runs/${mission.sourceAnalysisRunId}`}>View original report →</a>}<MissionCancel id={mission.id} enabled={canUpdate} /></div></footer>{actionTitle && <aside>From task: {actionTitle}</aside>}</article>)}{!active.length && <div className="panel-empty"><p>Choose a task with a product number, then set a target to start tracking it.</p><a href="/dashboard/actions">Choose a task</a></div>}</section>
    <section className="app-panel mission-history"><div className="panel-title"><div><span>HISTORY</span><h2>Finished follow-ups</h2></div><span className="status-pill">{finished.length} recorded</span></div>{finished.map(({ mission, productName }) => <article className="report-row" key={mission.id}><div><strong>{mission.title}</strong><small>{productName || 'Removed product'} · {mission.metric} · {Math.round(mission.progressPercent)}% of target · {mission.finishedAt?.slice(0, 10) || 'closed'}</small></div><span>{formatValue(mission.latestValue, mission.currency)} / {formatValue(mission.targetValue, mission.currency)}</span><b data-status={mission.status}>{mission.status}</b></article>)}{!finished.length && <div className="panel-empty"><p>Completed, missed, cancelled, and data-missing follow-ups will stay here.</p></div>}</section>
  </div>;
}
