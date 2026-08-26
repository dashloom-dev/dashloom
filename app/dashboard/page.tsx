import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { Activity, ArrowUpRight, Bot, Boxes, Check, CircleAlert, DollarSign, Users } from 'lucide-react';
import { getDb } from '@/db';
import { agentActions, aiProviderAccounts, analysisRuns, connectorAccounts, metricPoints, productConnectorMappings, productGoals, products, reportSchedules, syncRuns, workspaces } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { addRollupValue, finishRollup, type RollupAccumulator } from '@/lib/metric-rollup';
import { calculateProductHealth } from '@/lib/product-health';
import { buildActivationProgress, buildFirstValueGuide } from '@/lib/activation-progress';
import { evaluateProductGoals } from '@/lib/product-goals';

export default async function DashboardOverview() {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  if (!workspace) return <div className="empty-state"><h1>Workspace setup needs attention</h1><p>Your account exists, but no workspace membership was found.</p></div>;

  const db = getDb();
  const [productRows, metricRows, recentSyncs, healthPoints, healthDates, latestAnalysisRows, openActions, sourceMappings, connectedProviders, actedOnFindings, enabledSchedules, activeGoalRows, goalMetricRows] = await Promise.all([
    db.select().from(products).where(and(eq(products.workspaceId, workspace.id), eq(products.status, 'active'))).orderBy(products.name),
    db.select({ metric: metricPoints.metric, dimensionsJson: metricPoints.dimensionsJson, value: sql<number>`sum(${metricPoints.value})` }).from(metricPoints).where(and(eq(metricPoints.workspaceId, workspace.id), gte(metricPoints.metricDate, sql`date('now', '-29 days')`))).groupBy(metricPoints.metric, metricPoints.dimensionsJson),
    db.select().from(syncRuns).where(eq(syncRuns.workspaceId, workspace.id)).orderBy(desc(syncRuns.createdAt)).limit(6),
    db.select().from(metricPoints).where(and(eq(metricPoints.workspaceId, workspace.id), gte(metricPoints.metricDate, sql`date('now', '-13 days')`))).orderBy(metricPoints.metricDate).limit(5000),
    db.select({ split: sql<string>`date('now', '-6 days')` }).from(workspaces).where(eq(workspaces.id, workspace.id)).limit(1),
    db.select({ id: analysisRuns.id, findingsJson: analysisRuns.findingsJson, createdAt: analysisRuns.createdAt }).from(analysisRuns).where(and(eq(analysisRuns.workspaceId, workspace.id), eq(analysisRuns.status, 'success'))).orderBy(desc(analysisRuns.createdAt)).limit(1),
    db.select().from(agentActions).where(and(eq(agentActions.workspaceId, workspace.id), inArray(agentActions.status, ['suggested', 'planned', 'in_progress']))).orderBy(sql`case ${agentActions.severity} when 'critical' then 1 when 'warning' then 2 when 'opportunity' then 3 else 4 end`, desc(agentActions.lastSeenAt)).limit(3),
    db.select({ id: productConnectorMappings.id }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspace.id), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected'))).limit(1),
    db.select({ id: aiProviderAccounts.id }).from(aiProviderAccounts).where(and(eq(aiProviderAccounts.workspaceId, workspace.id), eq(aiProviderAccounts.status, 'connected'))).limit(1),
    db.select({ id: agentActions.id }).from(agentActions).where(and(eq(agentActions.workspaceId, workspace.id), inArray(agentActions.status, ['planned', 'in_progress', 'done']))).limit(1),
    db.select({ id: reportSchedules.id }).from(reportSchedules).where(and(eq(reportSchedules.workspaceId, workspace.id), eq(reportSchedules.enabled, true))).limit(1),
    db.select({ goal: productGoals, productName: products.name }).from(productGoals).innerJoin(products, eq(productGoals.productId, products.id)).where(and(eq(productGoals.workspaceId, workspace.id), eq(productGoals.enabled, true))).orderBy(productGoals.name),
    db.select({ productId: metricPoints.productId, source: metricPoints.source, metric: metricPoints.metric, metricDate: metricPoints.metricDate, value: metricPoints.value, dimensionsJson: metricPoints.dimensionsJson }).from(metricPoints).where(and(eq(metricPoints.workspaceId, workspace.id), gte(metricPoints.metricDate, sql`date('now', '-89 days')`))).limit(20000),
  ]);
  const totals = new Map<string, number>(); for (const row of metricRows) totals.set(row.metric, (totals.get(row.metric) || 0) + Number(row.value || 0));
  const users = totals.get('active_users') || totals.get('users') || 0;
  const revenueByCurrency = new Map<string, number>(); for (const row of metricRows.filter((item) => item.metric === 'revenue')) { let currency = 'UNSPECIFIED'; try { const dimensions = JSON.parse(row.dimensionsJson) as { currency?: unknown }; if (typeof dimensions.currency === 'string' && /^[a-z]{3}$/i.test(dimensions.currency)) currency = dimensions.currency.toUpperCase(); } catch { /* legacy rows remain explicitly unclassified */ } revenueByCurrency.set(currency, (revenueByCurrency.get(currency) || 0) + Number(row.value || 0)); }
  const revenue = revenueByCurrency.size ? [...revenueByCurrency].map(([currency, value]) => currency === 'UNSPECIFIED' ? `${formatNumber(value)} (currency unset)` : formatCurrency(value, currency)).join(' · ') : formatCurrency(0, 'USD');
  const requests = totals.get('requests') || 0;
  const empty = productRows.length === 0;
  const split = healthDates[0]?.split || '9999-12-31'; const emptyRollup = (): RollupAccumulator => ({ sum: 0, count: 0, latestDate: '', latestValue: 0 });
  const healthAggregates = new Map<string, { productId: string; source: string; metric: string; current: RollupAccumulator; previous: RollupAccumulator; freshness: string }>();
  for (const point of healthPoints) { const key = `${point.productId}:${point.source}:${point.metric}`; const item = healthAggregates.get(key) || { productId: point.productId, source: point.source, metric: point.metric, current: emptyRollup(), previous: emptyRollup(), freshness: point.metricDate }; addRollupValue(point.metricDate >= split ? item.current : item.previous, point.metricDate, point.value); if (point.metricDate > item.freshness) item.freshness = point.metricDate; healthAggregates.set(key, item); }
  const productHealth = new Map(productRows.map((product) => { const values = [...healthAggregates.values()].filter((item) => item.productId === product.id); const freshness = values.map((item) => item.freshness).sort().at(-1) || null; return [product.id, calculateProductHealth({ productId: product.id, freshness, metrics: values.map((item) => ({ metric: item.metric, source: item.source, current: finishRollup(item.metric, item.current), previous: finishRollup(item.metric, item.previous) })) })]; }));
  const operatingGoals = evaluateProductGoals(activeGoalRows.map(({ goal, productName }) => ({ ...goal, productName })), goalMetricRows, new Date().toISOString().slice(0, 10)).sort((a, b) => ({ off_track: 0, at_risk: 1, no_data: 2, achieved: 3 }[a.status] - { off_track: 0, at_risk: 1, no_data: 2, achieved: 3 }[b.status]));
  let latestAnalysis: { id: string; summary: string; action: string | null; createdAt: string } | null = null; const latestRow = latestAnalysisRows[0]; if (latestRow?.findingsJson) { try { const parsed = JSON.parse(latestRow.findingsJson) as { summary?: unknown; findings?: Array<{ action?: unknown }> }; if (typeof parsed.summary === 'string') latestAnalysis = { id: latestRow.id, summary: parsed.summary, action: typeof parsed.findings?.[0]?.action === 'string' ? parsed.findings[0].action : null, createdAt: latestRow.createdAt }; } catch { /* malformed historical output stays hidden */ } }
  const activation = buildActivationProgress({ productCount: productRows.length, sourceReady: sourceMappings.length > 0, recentEvidenceCount: healthPoints.length, modelReady: connectedProviders.length > 0, successfulAnalysisCount: latestAnalysisRows.length, actedOnFindingCount: actedOnFindings.length, reportScheduleCount: enabledSchedules.length });
  const firstValue = buildFirstValueGuide({ productCount: productRows.length, sourceReady: sourceMappings.length > 0, recentEvidenceCount: healthPoints.length, modelReady: connectedProviders.length > 0, successfulAnalysisCount: latestAnalysisRows.length });

  return <div className="app-page">
    <header className="app-page-head"><div><span>WORKSPACE OVERVIEW</span><h1>Good morning, {user.name.split(' ')[0]}.</h1><p>{empty ? 'Add your first product to begin connecting real data.' : `Monitoring ${productRows.length} active product${productRows.length === 1 ? '' : 's'} across your workspace.`}</p></div><LinkButton /></header>
    {!firstValue.complete && <section className="first-value-guide">
      <header><div><span>GET STARTED</span><h2>Reach your first evidence-backed answer</h2><p>Three steps turn a new workspace into a useful product brief. Progress comes from real workspace data, so there is nothing artificial to dismiss or skip.</p></div><b>{firstValue.completed}/{firstValue.total}</b></header>
      <div className="first-value-steps">{firstValue.steps.map((step, index) => <article key={step.id} data-state={step.state}><i>{step.complete ? <Check size={17} /> : index + 1}</i><div><span>{step.state === 'current' ? 'DO THIS NEXT' : step.complete ? 'COMPLETE' : 'COMING UP'}</span><h3>{step.title}</h3><p>{step.description}</p>{step.state === 'current' && <a className="app-primary" href={step.href}>{step.action} →</a>}</div></article>)}</div>
    </section>}
    <section className="real-metric-grid">
      <Metric icon={<Activity />} label="Products" value={String(productRows.length)} note="Active in this workspace" />
      <Metric icon={<Users />} label="Active users" value={formatNumber(users)} note="Last 30 days" />
      <Metric icon={<DollarSign />} label="Revenue" value={revenue} note="Last 30 days · currencies separated" />
      <Metric icon={<ArrowUpRight />} label="Requests" value={formatNumber(requests)} note="Last 30 days" />
    </section>
    {firstValue.complete && <section className="activation-center" data-activated={activation.activated}>
      <header><div><span>FIRST VALUE PATH</span><h2>{activation.activated ? 'Your Agent operating loop is active.' : `${activation.completed} of ${activation.total} milestones complete`}</h2><p>{activation.next ? `Next: ${activation.next.title}. ${activation.next.description}` : 'Real evidence now flows from collection through analysis, action, and recurring delivery.'}</p></div><strong>{Math.round((activation.completed / activation.total) * 100)}%</strong></header>
      <div className="activation-progress" role="progressbar" aria-label="First value path" aria-valuemin={0} aria-valuemax={activation.total} aria-valuenow={activation.completed}><i style={{ width: `${(activation.completed / activation.total) * 100}%` }} /></div>
      <div className="activation-steps">{activation.milestones.map((milestone, index) => <a key={milestone.id} href={milestone.href} data-state={milestone.state}><b>{milestone.complete ? <Check size={15} /> : index + 1}</b><span><strong>{milestone.title}</strong><small>{milestone.description}</small></span></a>)}</div>
    </section>}
    <section className="agent-highlight"><div className="agent-avatar"><Bot size={24} /></div><div><span>DASHLOOM AGENT{latestAnalysis ? ` · ${latestAnalysis.createdAt.slice(0, 10)}` : ''}</span><h2>{latestAnalysis?.summary || (empty ? 'Your Agent is waiting for evidence.' : 'Your first evidence brief will appear here.')}</h2><p>{latestAnalysis?.action ? `Priority action: ${latestAnalysis.action}` : empty ? 'Add a product and connect at least one data source. The Agent will never invent an analysis when the evidence layer is empty.' : 'Dashloom is collecting enough history to compare meaningful periods and cite every finding.'}</p></div><a href={latestAnalysis ? `/dashboard/agent/runs/${latestAnalysis.id}` : '/dashboard/agent'}>{latestAnalysis ? 'Inspect evidence →' : 'Open Agent →'}</a></section>
    {openActions.length > 0 && <section className="app-panel overview-actions"><div className="panel-title"><div><span>AGENT ACTION CENTER</span><h2>{openActions.length} highest-priority open moves</h2></div><a href="/dashboard/actions">Manage all →</a></div>{openActions.map((action) => <article className="report-row" key={action.id}><div><strong>{action.title}</strong><small>{action.recommendedAction} · seen {action.occurrenceCount}×</small></div><span>{action.severity}</span><b data-status={action.status}>{action.status.replaceAll('_', ' ')}</b></article>)}</section>}
    {operatingGoals.length > 0 && <section className="app-panel overview-goals"><div className="panel-title"><div><span>OPERATING TARGETS</span><h2>Progress the Agent can reason about</h2></div><a href="/dashboard/products">Manage goals →</a></div>{operatingGoals.slice(0, 4).map((goal) => <article className="report-row" key={goal.goalId}><div><strong>{goal.productName} · {goal.name}</strong><small>{goal.metric} · rolling {goal.period} · {goal.currentValue === null ? 'waiting for data' : `${goal.progressPercent?.toFixed(1)}% of target`}</small></div><span>{goal.currentValue === null ? '—' : goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()}</span><b data-status={goal.status}>{goal.status.replaceAll('_', ' ')}</b></article>)}</section>}
    <div className="overview-columns">
      <section className="app-panel"><div className="panel-title"><div><span>PRODUCT PORTFOLIO</span><h2>Deterministic product health</h2></div><a href="/dashboard/products">Manage products →</a></div>{empty ? <EmptyProducts /> : <div className="real-product-list">{productRows.slice(0, 6).map((product) => { const health = productHealth.get(product.id); return <article key={product.id}><div>{product.name.slice(0, 1).toUpperCase()}</div><span><strong>{product.name}</strong><small>{health?.reasons[0] || product.domain || 'No metric evidence yet'}</small></span><b data-status={health?.status}>{health ? `${health.score}/100` : '—'}</b></article>; })}</div>}</section>
      <section className="app-panel"><div className="panel-title"><div><span>SYNC HEALTH</span><h2>Recent collection runs</h2></div></div>{recentSyncs.length ? <div className="sync-list-real">{recentSyncs.map((run) => <article key={run.id}><i data-status={run.status} /><span><strong>{run.source}</strong><small>{run.recordsWritten} records · {run.status}</small></span></article>)}</div> : <div className="panel-empty"><CircleAlert size={24} /><p>No synchronization has run yet.</p><a href="/dashboard/sources">Connect a source</a></div>}</section>
    </div>
  </div>;
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <article><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
function formatNumber(value: number) { return Intl.NumberFormat('en', { notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value); }
function formatCurrency(value: number, currency: string) { return Intl.NumberFormat('en-US', { style: 'currency', currency, notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value); }
function LinkButton() { return <a className="app-primary" href="/dashboard/sources">Connect data source</a>; }
function EmptyProducts() { return <div className="panel-empty"><Boxes size={28} /><p>No fictional products here. Add the first product you actually operate.</p><a href="/dashboard/products">Add a product</a></div>; }
