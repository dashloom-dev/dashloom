import { and, desc, eq, gte, inArray, lte, max, notInArray } from 'drizzle-orm';
import Link from 'next/link';
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, CircleCheck, CircleDashed, Database, RefreshCw } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { getDb } from '@/db';
import { analysisRuns, dashboardViews, metricPoints, products, syncRuns } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { addRollupValue, finishRollup, type RollupAccumulator } from '@/lib/metric-rollup';
import { dashboardTemplates, parseDashboardConfiguration, type DashboardPreset } from '@/lib/dashboard-templates';
import { agentResultSchema } from '@/lib/agent';
import { getDeploymentLocale } from '@/lib/deployment-locale';
import { dashboardComparisonWindow } from '@/lib/dashboard-period';
import { aggregateDashboardRows, buildDashboardMetricCards, selectDashboardMetrics, dashboardBreakdownMetrics, humanize, formatMetric } from '@/lib/dashboard-summary';
import { DataChart } from '../../data-chart';

type DashboardLocale = 'en' | 'zh';
type SearchQuery = { view?: string; range?: string; metric?: string };
const chartColors = ['#59dbae', '#68a8ff', '#a983ff', '#f2b84b', '#ff8177', '#62c9d8'];

export async function DataDashboardPage({ params, searchParams }: { params: Promise<{ preset: string }>; searchParams: Promise<SearchQuery> }) {
  const { preset: requested } = await params;
  const query = await searchParams;
  if (!(requested in dashboardTemplates)) notFound();
  const template = dashboardTemplates[requested as DashboardPreset];
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const locale: DashboardLocale = getDeploymentLocale();
  const zh = locale === 'zh';
  if (!workspace) return <div className="empty-state"><h1>{zh ? '工作区不可用' : 'Workspace unavailable'}</h1><p>{zh ? '无法加载当前工作区。' : 'The selected workspace could not be loaded.'}</p></div>;

  const range = [7, 30, 90].includes(Number(query.range)) ? Number(query.range) : 30;
  const db = getDb();
  const [savedView] = await db.select().from(dashboardViews).where(query.view
    ? and(eq(dashboardViews.id, query.view), eq(dashboardViews.workspaceId, workspace.id), eq(dashboardViews.preset, requested as DashboardPreset))
    : and(eq(dashboardViews.workspaceId, workspace.id), eq(dashboardViews.preset, requested as DashboardPreset), eq(dashboardViews.isDefault, true))).limit(1);
  const configuration = savedView ? parseDashboardConfiguration(savedView.configurationJson) : {};
  const [sourceRun] = savedView?.sourceAnalysisRunId
    ? await db.select({ id: analysisRuns.id, findingsJson: analysisRuns.findingsJson, createdAt: analysisRuns.createdAt }).from(analysisRuns).where(and(eq(analysisRuns.id, savedView.sourceAnalysisRunId), eq(analysisRuns.workspaceId, workspace.id), eq(analysisRuns.status, 'success'))).limit(1)
    : [];
  const agentBriefing = sourceRun?.findingsJson ? parseAgentBriefing(sourceRun.findingsJson) : null;
  const productFilter = savedView?.productId ? and(eq(products.workspaceId, workspace.id), eq(products.id, savedView.productId)) : eq(products.workspaceId, workspace.id);
  const metricScope = and(eq(metricPoints.workspaceId, workspace.id), savedView?.productId ? eq(metricPoints.productId, savedView.productId) : undefined, notInArray(metricPoints.metric, dashboardBreakdownMetrics));
  const [productRows, [latestPoint], recentSyncRows] = await Promise.all([
    db.select().from(products).where(productFilter).orderBy(products.name),
    db.select({ metricDate: max(metricPoints.metricDate) }).from(metricPoints).where(metricScope),
    db.select().from(syncRuns).where(eq(syncRuns.workspaceId, workspace.id)).orderBy(desc(syncRuns.createdAt)).limit(80),
  ]);
  const dates = dashboardComparisonWindow(latestPoint?.metricDate, range);
  const currentMetricRows = dates ? await db.selectDistinct({ metric: metricPoints.metric }).from(metricPoints).where(and(metricScope, gte(metricPoints.metricDate, dates.split), lte(metricPoints.metricDate, dates.end))) : [];
  const dashboardMetrics = selectDashboardMetrics(currentMetricRows.map((row) => row.metric), configuration.metrics || template.metrics);
  const pointRows = dates && dashboardMetrics.length
    ? await db.select().from(metricPoints).where(and(metricScope, inArray(metricPoints.metric, dashboardMetrics), gte(metricPoints.metricDate, dates.start), lte(metricPoints.metricDate, dates.end))).orderBy(desc(metricPoints.metricDate)).limit(30000)
    : [];
  const byProduct = new Map(productRows.map((product) => [product.id, product]));
  const aggregates = aggregateDashboardRows(pointRows, dates?.split || '').map((row) => ({ ...row, product: byProduct.get(row.productId)?.name || row.productId }));
  const selectedMetric = dashboardMetrics.includes(query.metric || '') ? query.metric! : dashboardMetrics[0] || '';
  const metricCards = buildDashboardMetricCards(dashboardMetrics, aggregates);
  const selectedRows = aggregates.filter((row) => row.metric === selectedMetric && row.currentCount > 0).sort((a, b) => b.current - a.current);
  const trendLines = buildTrendLines(pointRows, selectedMetric, dates?.split || '', byProduct);
  const lastCollectedAt = pointRows.map((point) => point.collectedAt).sort().at(-1) || null;
  const latestSyncBySource = new Map<string, (typeof recentSyncRows)[number]>();
  for (const run of recentSyncRows) if (!latestSyncBySource.has(run.source)) latestSyncBySource.set(run.source, run);
  const sourceHealth = [...latestSyncBySource.values()];
  const syncing = sourceHealth.filter((run) => ['queued', 'running'].includes(run.status)).length;
  const healthySources = sourceHealth.filter((run) => ['success', 'partial'].includes(run.status)).length;
  const basePath = `/dashboard/views/${requested}`;
  const queryHref = (next: Partial<SearchQuery>) => `${basePath}?${new URLSearchParams(Object.entries({ ...(savedView ? { view: savedView.id } : {}), range: String(range), metric: selectedMetric, ...next }).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString()}`;
  const activeProducts = productRows.filter((product) => product.status !== 'archived');
  const scopeLabel = savedView?.productId ? productRows[0]?.name || (zh ? '指定产品' : 'Selected product') : zh ? `全部 ${activeProducts.length} 个产品` : `All ${activeProducts.length} products`;

  return <div className="app-page data-dashboard-page">
    <header className="app-page-head data-dashboard-head"><div><span>{zh ? '数据大盘' : 'DATA DASHBOARD'}{savedView ? ` · ${savedView.name}` : ''}</span><h1>{zh ? '产品经营数据，一处看清' : 'Your business data, in one place'}</h1><p>{zh ? '所有指标、趋势和产品排行使用同一个时间范围，并标明真实的数据日期与同步状态。' : 'Every metric, trend, and product ranking uses the same date range, with explicit data dates and sync health.'}</p></div><Link className="app-primary" href={`/dashboard/agent?preset=${template.agentPreset}`}>{zh ? '让 Agent 分析' : 'Ask Agent to analyze'}</Link></header>
    <section className="dashboard-toolbar" aria-label={zh ? '大盘筛选器' : 'Dashboard filters'}><div className="dashboard-range"><CalendarDays size={17} /><span>{zh ? '时间范围' : 'Date range'}</span>{[7, 30, 90].map((days) => <Link aria-current={days === range ? 'true' : undefined} href={queryHref({ range: String(days), metric: '' })} key={days}>{days === 30 ? (zh ? '近 30 天' : 'Last 30 days') : zh ? `近 ${days} 天` : `Last ${days} days`}</Link>)}</div><div className="dashboard-freshness"><span data-state={syncing ? 'syncing' : healthySources ? 'healthy' : 'empty'}>{syncing ? <RefreshCw size={15} /> : healthySources ? <CircleCheck size={15} /> : <CircleDashed size={15} />}{syncing ? (zh ? `${syncing} 个来源同步中` : `${syncing} sources syncing`) : healthySources ? (zh ? `${healthySources} 个来源已同步` : `${healthySources} sources synced`) : (zh ? '暂无同步记录' : 'No sync history')}</span><small>{zh ? `数据范围 ${dates?.split || '—'} 至 ${dates?.end || '—'} · ${scopeLabel}` : `Data from ${dates?.split || '—'} to ${dates?.end || '—'} · ${scopeLabel}`}</small></div></section>
    <section className="dashboard-status-strip"><div><Database size={17} /><span>{zh ? '最新数据日' : 'Latest data date'}</span><strong>{dates?.end || '—'}</strong></div><div><RefreshCw size={17} /><span>{zh ? '最近写入' : 'Last collected'}</span><strong>{formatCollectedAt(lastCollectedAt, locale)}</strong></div><div><Activity size={17} /><span>{zh ? '本期数据点' : 'Current-period points'}</span><strong>{pointRows.filter((point) => point.metricDate >= (dates?.split || '')).length.toLocaleString(zh ? 'zh-CN' : 'en-US')}</strong></div></section>
    {aggregates.length ? <><section className="dashboard-kpi-grid">{metricCards.map((card) => <article key={`${card.metric}:${card.currency || ''}`}><header><span>{humanize(card.metric, locale)}{card.currency ? ` · ${card.currency.toUpperCase()}` : ''}</span><b>{zh ? `${range} 天` : `${range} days`}</b></header><strong>{formatMetric(card.metric, card.current, card.currency, locale)}</strong><footer><MetricChange change={card.change} zh={zh} /><small>{zh ? `对比前 ${range} 天` : `vs previous ${range} days`}</small></footer></article>)}</section>
      <section className="dashboard-analysis-grid"><article className="app-panel dashboard-trend-panel"><header className="dashboard-panel-head"><div><span>{zh ? '统一口径趋势' : 'CONSISTENT TREND'}</span><h2>{humanize(selectedMetric, locale)}</h2><p>{zh ? `${dates?.split} 至 ${dates?.end}，按产品拆分` : `${dates?.split} to ${dates?.end}, split by product`}</p></div><div className="dashboard-metric-tabs">{dashboardMetrics.map((metric) => <Link aria-current={metric === selectedMetric ? 'true' : undefined} href={queryHref({ metric })} key={metric}>{humanize(metric, locale)}</Link>)}</div></header><DataChart lines={trendLines} height={290} label={`${humanize(selectedMetric, locale)} ${zh ? '趋势图' : 'trend chart'}`} /><div className="dashboard-chart-legend">{trendLines.map((line) => <span key={line.label} style={{ '--legend-color': line.color } as CSSProperties}>{line.label}</span>)}</div></article>
      <article className="app-panel dashboard-ranking"><div className="panel-title"><div><span>{zh ? '产品贡献' : 'PRODUCT CONTRIBUTION'}</span><h2>{zh ? '本期产品排行' : 'Product ranking this period'}</h2></div><span className="status-pill">{humanize(selectedMetric, locale)}</span></div>{selectedRows.slice(0, 8).map((row, index) => <div className="dashboard-rank-row" key={`${row.productId}:${row.currency || ''}`}><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{row.product}</strong><small>{row.latestDate}{row.currency ? ` · ${row.currency.toUpperCase()}` : ''}</small></span><em>{formatMetric(row.metric, row.current, row.currency, locale)}</em><MetricChange change={row.change} zh={zh} compact /></div>)}</article></section></> : <section className="app-panel dashboard-empty"><Database size={30} /><h2>{zh ? '这个时间范围还没有数据' : 'No data in this date range'}</h2><p>{zh ? '连接数据源并完成首次同步后，大盘只会展示真实存在的指标，不再用 0 填充缺失数据。' : 'Connect and sync a source. The dashboard will only show real metrics instead of filling missing ones with zero.'}</p><Link className="app-primary" href="/dashboard/sources">{zh ? '连接数据源' : 'Connect data source'}</Link></section>}
    {agentBriefing && sourceRun && <section className="app-panel smart-dashboard-briefing"><div className="panel-title"><div><span>{zh ? '已保存的 AI 报告' : 'SAVED AI REPORT'}</span><h2>{agentBriefing.summary}</h2></div><span className="status-pill">{zh ? `生成于 ${sourceRun.createdAt.slice(0, 10)}` : `Created ${sourceRun.createdAt.slice(0, 10)}`}</span></div><div className="smart-dashboard-findings">{agentBriefing.findings.slice(0, 4).map((finding, index) => <article key={`${sourceRun.id}:${index}`} data-severity={finding.severity}><header><strong>{finding.title}</strong><b>{Math.round(finding.confidence * 100)}%</b></header><p>{finding.detail}</p><small>{zh ? '建议：' : 'Suggested: '}{finding.action}</small></article>)}</div><footer><span>{zh ? '报告保留生成时的数据快照；上方大盘始终使用当前筛选范围。' : 'The report keeps its original snapshot; the dashboard above uses the active date range.'}</span><Link href={`/dashboard/agent/runs/${sourceRun.id}`}>{zh ? '查看报告数据 →' : 'View report data →'}</Link></footer></section>}
  </div>;
}

function accumulator(): RollupAccumulator { return { sum: 0, count: 0, latestDate: '', latestValue: 0 }; }
function buildTrendLines(pointRows: Array<typeof metricPoints.$inferSelect>, metric: string, split: string, byProduct: Map<string, typeof products.$inferSelect>) { const grouped = new Map<string, Map<string, RollupAccumulator>>(); for (const point of pointRows.filter((item) => item.metric === metric && item.metricDate >= split)) { const daily = grouped.get(point.productId) || new Map<string, RollupAccumulator>(); const value = daily.get(point.metricDate) || accumulator(); addRollupValue(value, point.metricDate, point.value); daily.set(point.metricDate, value); grouped.set(point.productId, daily); } return [...grouped].map(([productId, daily], index) => ({ label: byProduct.get(productId)?.name || productId, color: chartColors[index % chartColors.length], points: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value: finishRollup(metric, value) })) })).filter((line) => line.points.length).sort((a, b) => (b.points.at(-1)?.value || 0) - (a.points.at(-1)?.value || 0)).slice(0, 6); }
function MetricChange({ change, zh, compact = false }: { change: number | null; zh: boolean; compact?: boolean }) { if (change === null) return <span className="metric-change" data-tone="neutral">—</span>; const positive = change >= 0; return <span className="metric-change" data-tone={positive ? 'positive' : 'negative'}>{positive ? <ArrowUpRight size={compact ? 13 : 15} /> : <ArrowDownRight size={compact ? 13 : 15} />}{Math.abs(change).toFixed(1)}%{compact ? '' : zh ? ' 较上期' : ' vs prior'}</span>; }
function parseAgentBriefing(value: string) { try { return agentResultSchema.parse(JSON.parse(value)); } catch { return null; } }
function formatCollectedAt(value: string | null, locale: DashboardLocale) { if (!value) return '—'; const date = new Date(value); if (Number.isNaN(date.getTime())) return value.slice(0, 16).replace('T', ' '); return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date); }
