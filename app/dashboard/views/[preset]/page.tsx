import { and, eq, gte, inArray, lte, max } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { analysisRuns, dashboardViews, metricPoints, products } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { addRollupValue, finishRollup, metricRollup, type RollupAccumulator } from '@/lib/metric-rollup';
import { dashboardTemplates, parseDashboardConfiguration, type DashboardPreset } from '@/lib/dashboard-templates';
import { agentResultSchema } from '@/lib/agent';
import { translateDashboard } from '../../dashboard-translations';
import { getDeploymentLocale } from '@/lib/deployment-locale';
import { dashboardComparisonWindow } from '@/lib/dashboard-period';

type DashboardLocale = 'en' | 'zh';

export default async function IntelligenceViewPage({ params, searchParams }: { params: Promise<{ preset: string }>; searchParams: Promise<{ view?: string }> }) {
  const { preset: requested } = await params;
  const query = await searchParams;
  if (!(requested in dashboardTemplates)) notFound();
  const template = dashboardTemplates[requested as DashboardPreset];
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const locale: DashboardLocale = getDeploymentLocale();
  const zh = locale === 'zh';
  const t = (value: string) => zh ? translateDashboard(value) : value;
  if (!workspace) return <div className="empty-state"><h1>{t('Workspace unavailable')}</h1><p>{t('The selected workspace could not be loaded.')}</p></div>;
  const [savedView] = workspace ? await getDb().select().from(dashboardViews).where(query.view ? and(eq(dashboardViews.id, query.view), eq(dashboardViews.workspaceId, workspace.id), eq(dashboardViews.preset, requested as DashboardPreset)) : and(eq(dashboardViews.workspaceId, workspace.id), eq(dashboardViews.preset, requested as DashboardPreset), eq(dashboardViews.isDefault, true))).limit(1) : [];
  const configuration = savedView ? parseDashboardConfiguration(savedView.configurationJson) : {};
  const [sourceRun] = savedView?.sourceAnalysisRunId ? await getDb().select({ id: analysisRuns.id, findingsJson: analysisRuns.findingsJson, createdAt: analysisRuns.createdAt }).from(analysisRuns).where(and(eq(analysisRuns.id, savedView.sourceAnalysisRunId), eq(analysisRuns.workspaceId, workspace?.id || ''), eq(analysisRuns.status, 'success'))).limit(1) : [];
  const agentBriefing = sourceRun?.findingsJson ? parseAgentBriefing(sourceRun.findingsJson) : null;
  const definition = { ...template, title: configuration.title || savedView?.name || template.title, copy: configuration.copy || template.copy, metrics: configuration.metrics || [...template.metrics] };
  const productFilter = savedView?.productId ? and(eq(products.workspaceId, workspace.id), eq(products.id, savedView.productId)) : eq(products.workspaceId, workspace.id);
  const pointFilter = and(eq(metricPoints.workspaceId, workspace.id), savedView?.productId ? eq(metricPoints.productId, savedView.productId) : undefined, inArray(metricPoints.metric, definition.metrics));
  const [productRows, [latestPoint]] = await Promise.all([
    getDb().select().from(products).where(productFilter).orderBy(products.name),
    getDb().select({ metricDate: max(metricPoints.metricDate) }).from(metricPoints).where(pointFilter),
  ]);
  const dates = dashboardComparisonWindow(latestPoint?.metricDate);
  const pointRows = dates ? await getDb().select().from(metricPoints).where(and(pointFilter, gte(metricPoints.metricDate, dates.start), lte(metricPoints.metricDate, dates.end))).orderBy(metricPoints.metricDate).limit(5000) : [];
  const byProduct = new Map(productRows.map((product) => [product.id, product]));
  const emptyRollup = (): RollupAccumulator => ({ sum: 0, count: 0, latestDate: '', latestValue: 0 });
  const aggregates = new Map<string, { metric: string; currency: string | null; current: RollupAccumulator; previous: RollupAccumulator }>();
  for (const point of pointRows.filter((point) => (!savedView?.productId || point.productId === savedView.productId) && (definition.metrics as readonly string[]).includes(point.metric))) {
    const currency = metricCurrency(point.dimensionsJson); const key = `${point.productId}:${point.metric}:${currency || ''}`;
    const aggregate = aggregates.get(key) || { metric: point.metric, currency, current: emptyRollup(), previous: emptyRollup() };
    addRollupValue(point.metricDate >= dates!.split ? aggregate.current : aggregate.previous, point.metricDate, point.value);
    aggregates.set(key, aggregate);
  }
  const rows = [...aggregates].map(([key, value]) => { const [productId, metric] = key.split(':'); const current = finishRollup(metric, value.current); const previous = finishRollup(metric, value.previous); return { productId, product: byProduct.get(productId)?.name || productId, metric, currency: value.currency, current, previous, change: previous ? ((current - previous) / Math.abs(previous)) * 100 : null }; }).sort((a, b) => b.current - a.current);
  const totalFor = (metric: string, currency: string | null, period: 'current' | 'previous') => { const values = rows.filter((row) => row.metric === metric && row.currency === currency).map((row) => row[period]); if (!values.length) return 0; return metricRollup(metric) === 'average' ? values.reduce((sum, value) => sum + value, 0) / values.length : values.reduce((sum, value) => sum + value, 0); };
  const metricCards = definition.metrics.flatMap((metric) => { const currencies = [...new Set(rows.filter((row) => row.metric === metric).map((row) => row.currency))]; return (currencies.length ? currencies : [null]).map((currency) => ({ metric, currency })); });
  return <div className="app-page"><header className="app-page-head"><div><span>{t(definition.eyebrow)}{savedView ? ` · ${savedView.name}` : ''}</span><h1>{t(definition.title)}</h1><p>{t(definition.copy)}</p></div><a className="app-primary" href={`/dashboard/agent?preset=${definition.agentPreset}`}>{zh ? `询问${t(definition.agent)}` : `Ask ${definition.agent}`}</a></header>
    <section className="view-metric-grid">{metricCards.map(({ metric, currency }) => { const current = totalFor(metric, currency, 'current'); const previous = totalFor(metric, currency, 'previous'); const change = previous ? ((current - previous) / Math.abs(previous)) * 100 : null; return <article key={`${metric}:${currency || ''}`}><span>{humanize(metric, locale)}{currency ? ` · ${currency.toUpperCase()}` : ''}</span><strong>{formatMetric(metric, current, currency, locale)}</strong><small>{change === null ? t('No comparable prior evidence') : zh ? `较前 7 天${change >= 0 ? '增长' : '下降'} ${Math.abs(change).toFixed(1)}%` : `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs prior 7 days`}</small></article>; })}</section>
    {agentBriefing && sourceRun && <section className="app-panel smart-dashboard-briefing"><div className="panel-title"><div><span>{t('AGENT-GENERATED BRIEFING')}</span><h2>{agentBriefing.summary}</h2></div><span className="status-pill">{zh ? `已冻结 · ${sourceRun.createdAt.slice(0, 10)}` : `Frozen ${sourceRun.createdAt.slice(0, 10)}`}</span></div><div className="smart-dashboard-findings">{agentBriefing.findings.slice(0, 5).map((finding, index) => <article key={`${sourceRun.id}:${index}`} data-severity={finding.severity}><header><strong>{finding.title}</strong><b>{Math.round(finding.confidence * 100)}%</b></header><p>{finding.detail}</p><small>{zh ? '下一步：' : 'Next: '}{finding.action}</small></article>)}</div><footer><span>{t('This briefing is a stored Agent conclusion; metric cards above continue to use current workspace evidence.')}</span><a href={`/dashboard/agent/runs/${sourceRun.id}`}>{t('Inspect frozen evidence →')}</a></footer></section>}
    <section className="app-panel view-evidence"><div className="panel-title"><div><span>{t('EVIDENCE TABLE')}</span><h2>{t('Product and metric movement')}</h2></div><span className="status-pill">{zh ? `${pointRows.length} 个数据点 · 截至 ${dates?.end || '—'}` : `${pointRows.length} points · through ${dates?.end || '—'}`}</span></div>{rows.slice(0, 30).map((row) => <article className="evidence-row" key={`${row.productId}:${row.metric}:${row.currency || ''}`}><div><strong>{row.product}</strong><small>{humanize(row.metric, locale)}{row.currency ? ` · ${row.currency.toUpperCase()}` : ''}</small></div><span>{formatMetric(row.metric, row.previous, row.currency, locale)}</span><b>{formatMetric(row.metric, row.current, row.currency, locale)}</b><em>{row.change === null ? '—' : `${row.change >= 0 ? '+' : ''}${row.change.toFixed(1)}%`}</em></article>)}{!rows.length && <div className="panel-empty"><p>{t('This view has no matching evidence yet. Connect a source or import metrics with the names shown above.')}</p><a href="/dashboard/sources">{t('Connect evidence →')}</a></div>}</section>
  </div>;
}

function humanize(value: string, locale: DashboardLocale) { const label = value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()); return locale === 'zh' ? translateDashboard(label) : label; }
function parseAgentBriefing(value: string) { try { return agentResultSchema.parse(JSON.parse(value)); } catch { return null; } }
function metricCurrency(dimensionsJson: string) { try { const value = JSON.parse(dimensionsJson) as { currency?: unknown }; return typeof value.currency === 'string' && /^[a-z]{3}$/i.test(value.currency) ? value.currency.toLowerCase() : null; } catch { return null; } }
function formatMetric(metric: string, value: number, currency: string | null = null, locale: DashboardLocale = 'en') {
  const numberLocale = locale === 'zh' ? 'zh-CN' : 'en-US';
  if (metric.includes('revenue') || metric === 'mrr' || metric === 'refunds') return currency ? new Intl.NumberFormat(numberLocale, { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(value) : `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(value)}${locale === 'zh' ? '（未设置币种）' : ' (currency unset)'}`;
  if (metric === 'ctr' || metric.includes('rate')) return `${(value * (value <= 1 ? 100 : 1)).toFixed(1)}%`;
  if (metric.endsWith('_bytes')) return formatBytes(value, numberLocale);
  if (metric.endsWith('_duration_ms')) return formatDuration(value, locale);
  if (metric.includes('cpu') || metric.includes('time') || metric === 'position') return value.toFixed(2);
  return new Intl.NumberFormat(numberLocale, { notation: value >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}
function formatBytes(value: number, numberLocale: string) { const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']; let amount = Math.max(0, value); let unit = 0; while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; } return `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: amount < 10 && unit ? 2 : 1 }).format(amount)} ${units[unit]}`; }
function formatDuration(value: number, locale: DashboardLocale) { const seconds = Math.max(0, value) / 1000; return seconds < 60 ? `${seconds.toFixed(seconds < 10 ? 1 : 0)}${locale === 'zh' ? ' 秒' : ' s'}` : `${(seconds / 60).toFixed(seconds < 600 ? 1 : 0)}${locale === 'zh' ? ' 分钟' : ' min'}`; }
