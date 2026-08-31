import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, CalendarDays, Database, Layers3 } from 'lucide-react';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { getDeploymentLocale } from '@/lib/deployment-locale';
import { formatMetric, loadDashboardData, metricDelta, pickMetric, seriesFor } from '@/lib/dashboard-data';
import { Sparkline } from '../data-chart';

const keyMetrics = [
  { label: 'Visitors', candidates: ['active_users', 'users', 'visitors', 'sessions'] },
  { label: 'Page views', candidates: ['page_views', 'screen_page_views', 'views'] },
  { label: 'Revenue', candidates: ['revenue', 'gross_revenue', 'mrr'] },
  { label: 'Requests', candidates: ['requests', 'request_count', 'api_requests'] },
  { label: 'Clicks', candidates: ['clicks'] },
  { label: 'Impressions', candidates: ['impressions'] },
] as const;

export default async function DataOverviewPage({ searchParams }: { searchParams: Promise<{ range?: string; sort?: string }> }) {
  const { user } = await requireServerSession(); const workspace = await getPrimaryWorkspace(user.id); const query = await searchParams; const zh = getDeploymentLocale() === 'zh';
  if (!workspace) return <div className="empty-state"><h1>{zh ? '工作空间不可用' : 'Workspace unavailable'}</h1></div>;
  const range = [7, 28, 90].includes(Number(query.range)) ? Number(query.range) : 28;
  const { products, points } = await loadDashboardData(workspace.id, 180);
  const cards = products.filter((product) => product.status !== 'archived').map((product) => {
    const series = seriesFor(points, range, product.id); const metrics = keyMetrics.map((definition) => ({ ...definition, series: pickMetric(series, [...definition.candidates]) }));
    const score = metrics.find((metric) => metric.label === 'Page views')?.series?.current || metrics.find((metric) => metric.label === 'Visitors')?.series?.current || series.reduce((sum, item) => sum + Math.abs(item.current), 0);
    return { product, series, metrics, score, latestDate: series.map((item) => item.latestDate).sort().at(-1) || null, sources: new Set(series.map((item) => item.source)).size };
  }).sort((a, b) => query.sort === 'name' ? a.product.name.localeCompare(b.product.name) : query.sort === 'freshness' ? (b.latestDate || '').localeCompare(a.latestDate || '') : b.score - a.score);
  const latestDate = points.map((point) => point.metricDate).sort().at(-1) || null;
  return <div className="app-page data-overview-page">
    <header className="app-page-head"><div><span>{zh ? '数据 · 产品组合' : 'DATA · PRODUCT PORTFOLIO'}</span><h1>{zh ? '数据总览' : 'Data overview'}</h1><p>{zh ? '在同一时间窗口内比较所有产品，快速发现增长、收入和使用量的变化，再下钻查看单个产品。' : 'Compare every product in the same time window, spot movement, and drill into product-level evidence.'}</p></div><Link className="app-secondary" href="/dashboard/charts">{zh ? '打开数据图表' : 'Open data charts'} <ArrowRight size={16} /></Link></header>
    <section className="data-toolbar" aria-label={zh ? '数据筛选' : 'Data filters'}><div className="range-tabs">{[7, 28, 90].map((days) => <Link aria-current={range === days ? 'page' : undefined} href={`/dashboard/data?range=${days}&sort=${query.sort || 'volume'}`} key={days}>{days} {zh ? '天' : 'days'}</Link>)}</div><div className="sort-links"><span>{zh ? '排序' : 'Sort'}:</span>{[['volume', zh ? '数据量' : 'Volume'], ['freshness', zh ? '最新' : 'Freshness'], ['name', zh ? '名称' : 'Name']].map(([value, label]) => <Link aria-current={(query.sort || 'volume') === value ? 'page' : undefined} href={`/dashboard/data?range=${range}&sort=${value}`} key={value}>{label}</Link>)}</div></section>
    <section className="data-summary-strip"><Summary icon={<Boxes />} label={zh ? '产品' : 'Products'} value={String(cards.length)} note={zh ? '当前组合' : 'in this portfolio'} /><Summary icon={<Database />} label={zh ? '数据源' : 'Sources'} value={String(new Set(points.map((point) => point.source)).size)} note={zh ? '已有真实数据' : 'with real evidence'} /><Summary icon={<Layers3 />} label={zh ? '指标' : 'Metrics'} value={String(new Set(points.map((point) => point.metric)).size)} note={zh ? '标准化指标' : 'normalized signals'} /><Summary icon={<CalendarDays />} label={zh ? '最近同步' : 'Latest evidence'} value={latestDate || '—'} note={latestDate ? (zh ? '最近数据日期' : 'latest metric date') : (zh ? '等待首次同步' : 'waiting for sync')} /></section>
    {cards.length ? <section className="product-data-grid">{cards.map(({ product, series, metrics, latestDate: productLatest, sources }) => { const primary = pickMetric(series, ['page_views', 'active_users', 'visitors', 'requests']) || series[0]; return <Link className="product-data-card" href={`/dashboard/data/${product.id}?range=${range}`} key={product.id}><header><div className="product-data-avatar">{product.name.slice(0, 1).toUpperCase()}</div><div><span>{product.category || (zh ? '产品' : 'PRODUCT')}</span><h2>{product.name}</h2><p>{product.domain || (zh ? '未设置域名' : 'No domain configured')}</p></div><ArrowRight size={18} /></header><div className="product-data-meta"><span>{sources} {zh ? '个数据源' : `source${sources === 1 ? '' : 's'}`}</span><span>{series.length} {zh ? '项指标' : `metric${series.length === 1 ? '' : 's'}`}</span><span>{productLatest || (zh ? '暂无数据' : 'No evidence')}</span></div><div className="product-kpi-grid">{metrics.map((metric) => <MetricCell key={metric.label} label={zh ? translateMetric(metric.label) : metric.label} value={metric.series ? formatMetric(metric.series.current, metric.series.metric) : '—'} delta={metricDelta(metric.series)} />)}</div><Sparkline points={primary?.values || []} label={`${product.name} ${primary?.metric || 'activity'} trend`} /></Link>; })}</section> : <section className="data-empty app-panel"><Database size={28} /><h2>{zh ? '还没有可比较的产品数据' : 'No product data to compare yet'}</h2><p>{zh ? '先添加产品并连接至少一个数据源。数据总览只显示真实采集到的指标。' : 'Add a product and connect at least one source. This overview only renders real collected metrics.'}</p><div><Link className="app-primary" href="/dashboard/products/new">{zh ? '添加产品' : 'Add product'}</Link><Link className="app-secondary" href="/dashboard/sources">{zh ? '连接数据源' : 'Connect data source'}</Link></div></section>}
    {points.length > 0 && <p className="data-footnote">{zh ? `当前显示最近 ${range} 天，所有金额按原始币种保留，不跨币种合并。` : `Showing the last ${range} days. Monetary values preserve their source currency and are not combined across currencies.`}</p>}
  </div>;
}

function Summary({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) { return <article><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function MetricCell({ label, value, delta }: { label: string; value: string; delta: number | null }) { const positive = delta !== null && delta >= 0; return <div><span>{label}</span><strong>{value}</strong><small data-tone={delta === null ? 'neutral' : positive ? 'positive' : 'negative'}>{delta === null ? '—' : <>{positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(delta).toFixed(1)}%</>}</small></div>; }
function translateMetric(label: string) { return ({ Visitors: '访客', 'Page views': '页面浏览', Revenue: '收入', Requests: '请求数', Clicks: '点击数', Impressions: '展示数' } as Record<string, string>)[label] || label; }
