import { and, eq, gte, notInArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { metricPoints, products } from '@/db/schema';
import { addRollupValue, finishRollup, type RollupAccumulator } from './metric-rollup';

export type DashboardPoint = { productId: string; source: string; metric: string; metricDate: string; value: number; dimensionsJson: string };
export type DashboardProduct = { id: string; name: string; domain: string | null; category: string | null; status: 'active' | 'paused' | 'archived' };
export type MetricSeries = { metric: string; source: string; values: Array<{ date: string; value: number }>; current: number; previous: number; latestDate: string };

const dashboardBreakdownMetrics = ['query_clicks', 'query_impressions', 'query_position', 'page_clicks', 'page_impressions', 'page_position'];

export function dateOffset(offset: number) { return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10); }

export async function loadDashboardData(workspaceId: string, days = 90) {
  const [productRows, points] = await Promise.all([
    getDb().select({ id: products.id, name: products.name, domain: products.domain, category: products.category, status: products.status }).from(products).where(eq(products.workspaceId, workspaceId)).orderBy(products.name),
    getDb().select({ productId: metricPoints.productId, source: metricPoints.source, metric: metricPoints.metric, metricDate: metricPoints.metricDate, value: metricPoints.value, dimensionsJson: metricPoints.dimensionsJson }).from(metricPoints).where(and(
      eq(metricPoints.workspaceId, workspaceId),
      gte(metricPoints.metricDate, dateOffset(-(days - 1))),
      notInArray(metricPoints.metric, dashboardBreakdownMetrics),
    )).limit(30000),
  ]);
  return { products: productRows, points };
}

export function seriesFor(points: DashboardPoint[], range: number, productId?: string | null): MetricSeries[] {
  const windowStart = dateOffset(-(range - 1));
  const priorStart = dateOffset(-(range * 2 - 1));
  const relevant = points.filter((point) => (!productId || point.productId === productId) && point.metricDate >= priorStart);
  const grouped = new Map<string, DashboardPoint[]>();
  for (const point of relevant) {
    const key = `${point.metric}\u0000${point.source}`;
    grouped.set(key, [...(grouped.get(key) || []), point]);
  }
  return [...grouped.values()].map((rows) => {
    const { metric, source } = rows[0];
    const current = accumulator(); const previous = accumulator(); const daily = new Map<string, RollupAccumulator>();
    for (const row of rows) {
      const target = row.metricDate >= windowStart ? current : previous;
      addRollupValue(target, row.metricDate, row.value);
      if (row.metricDate >= windowStart) { const day = daily.get(row.metricDate) || accumulator(); addRollupValue(day, row.metricDate, row.value); daily.set(row.metricDate, day); }
    }
    return { metric, source, values: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value: finishRollup(metric, value) })), current: finishRollup(metric, current), previous: finishRollup(metric, previous), latestDate: current.latestDate };
  }).sort((a, b) => b.current - a.current);
}

export function combinedMetricSeries(points: DashboardPoint[], metric: string, range: number, productId?: string | null) {
  const rows = seriesFor(points, range, productId).filter((series) => series.metric === metric);
  const byDate = new Map<string, number>();
  for (const row of rows) for (const point of row.values) byDate.set(point.date, (byDate.get(point.date) || 0) + point.value);
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

export function pickMetric(series: MetricSeries[], candidates: string[]) { return candidates.map((metric) => series.find((row) => row.metric === metric)).find(Boolean); }
export function metricLabel(metric: string) { return metric.split('_').map((word) => word === 'mrr' || word === 'ctr' ? word.toUpperCase() : `${word[0]?.toUpperCase() || ''}${word.slice(1)}`).join(' '); }
export function metricDelta(series?: MetricSeries) { if (!series || !series.previous) return null; return ((series.current - series.previous) / Math.abs(series.previous)) * 100; }
export function formatMetric(value: number, metric = '', currency?: string | null) {
  if (currency || ['revenue', 'mrr', 'arr', 'refunds'].includes(metric)) return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', notation: Math.abs(value) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
  if (metric.endsWith('_rate') || metric === 'ctr') return `${value.toFixed(value < 10 ? 1 : 0)}%`;
  if (metric.includes('duration') || metric.endsWith('_seconds')) return `${Math.round(value).toLocaleString()}s`;
  return new Intl.NumberFormat('en-US', { notation: Math.abs(value) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}
function accumulator(): RollupAccumulator { return { sum: 0, count: 0, latestDate: '', latestValue: 0 }; }
