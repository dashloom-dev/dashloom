import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { aiProviderAccounts, products, reportSchedules, reports } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { ReportControls } from './report-controls';
import { ScheduleForm } from './schedule-form';
import { getWorkspaceAgentReadiness, getWorkspaceAgentReadinessByProduct } from '@/lib/agent-readiness';
import { agentDefinitions, type AgentPreset } from '@/lib/agent-catalog';
import { ScheduleList } from './schedule-list';
import { executiveBriefCapacity } from '@/lib/executive-brief-runner';
import { agentScopeLabel } from '@/lib/agent-scope';

const agentPresets = Object.keys(agentDefinitions) as AgentPreset[];

export default async function ReportsPage() {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const [items, providers, readiness, schedules, productRows, briefCapacity] = workspace ? await Promise.all([
    getDb().select().from(reports).where(eq(reports.workspaceId, workspace.id)).orderBy(desc(reports.createdAt)).limit(30),
    getDb().select().from(aiProviderAccounts).where(eq(aiProviderAccounts.workspaceId, workspace.id)),
    getWorkspaceAgentReadiness(workspace.id),
    getDb().select().from(reportSchedules).where(eq(reportSchedules.workspaceId, workspace.id)),
    getDb().select({ id: products.id, name: products.name }).from(products).where(eq(products.workspaceId, workspace.id)).orderBy(products.name),
    executiveBriefCapacity(workspace.id, 'dailyLimit'),
  ]) : [[], [], null, [], [], { mode: 'byok', capacity: 0, remaining: null, ready: false }];
  const modelReady = providers.some((provider) => provider.status === 'connected' && provider.mode === 'byok');
  const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const readinessByProduct = workspace ? await getWorkspaceAgentReadinessByProduct(workspace.id, productRows.map((product) => product.id)) : {};
  const readinessFlags = Object.fromEntries(agentPresets.map((preset) => [preset, modelReady && Boolean(readiness?.[preset].ready)]));
  const readinessByScope = Object.fromEntries([['workspace', readinessFlags], ...productRows.map((product) => [product.id, Object.fromEntries(agentPresets.map((preset) => [preset, modelReady && Boolean(readinessByProduct[product.id]?.[preset].ready)]))])]);
  const defaultPreset = agentPresets.find((preset) => readinessFlags[preset]) || 'portfolio_analyst';
  const schedulesWithScope = schedules.map((schedule) => ({ ...schedule, scopeLabel: agentScopeLabel({ mode: schedule.scopeMode, productId: schedule.productId }, productRows) }));
  const reportsWithScope = items.map((item) => ({ ...item, scopeLabel: agentScopeLabel({ mode: item.scopeMode, productId: item.productId }, productRows) }));
  return <div className="app-page"><header className="app-page-head"><div><span>RECURRING INTELLIGENCE</span><h1>Reports</h1><p>Daily, weekly, monthly, and on-demand reports share the same auditable evidence as Agent conversations.</p></div></header>
    <ReportControls readinessByScope={readinessByScope} defaultPreset={defaultPreset} products={productRows} /><ScheduleForm readinessByScope={readinessByScope} defaultPreset={defaultPreset} products={productRows} timezone={workspace?.timezone || 'UTC'} capacity={briefCapacity} canManage={canManage} />
    <ScheduleList schedules={schedulesWithScope} canManage={canManage} />
    <section className="app-panel"><div className="panel-title"><div><span>REPORT HISTORY</span><h2>{items.length ? `${items.length} generated reports` : 'No reports generated yet'}</h2></div><span className="status-pill">stored in this deployment</span></div>{reportsWithScope.map((item) => <article className="report-row report-row-action" key={item.id}><div><strong>{item.title}</strong><small>{item.scopeLabel} · {item.periodStart} – {item.periodEnd}{item.executiveBriefId ? ' · multi-specialist' : ''}</small></div><span>{item.cadence}</span><b data-status={item.status}>{item.status}</b>{item.executiveBriefId && <a className="report-deliver" href={`/dashboard/agent/briefings/${item.executiveBriefId}`}>Evidence</a>}</article>)}{!items.length && <div className="panel-empty"><p>Generate a report after connecting evidence and a BYOK provider.</p><a href="/dashboard/agent">Review Agent setup →</a></div>}</section>
  </div>;
}
