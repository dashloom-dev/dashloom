import { addRollupValue, finishRollup, metricRollup, type RollupAccumulator } from './metric-rollup.ts';

type DashboardLocale = 'en' | 'zh';
export type DashboardSummaryPoint = {
  productId: string; metric: string; metricDate: string; value: number; dimensionsJson: string;
};
export type DashboardSummaryRow = {
  productId: string; metric: string; currency: string | null;
  current: number; previous: number; change: number | null; latestDate: string;
  currentCount: number; previousCount: number;
};

// Granular search evidence belongs in Agent analysis, not headline KPI selection.
export const dashboardBreakdownMetrics = ['query_clicks', 'query_impressions', 'query_position', 'page_clicks', 'page_impressions', 'page_position'];
const metricPriority = ['revenue', 'mrr', 'active_users', 'users', 'paid_customers', 'clicks', 'impressions', 'requests', 'errors', 'repo_stars', 'repo_commits'];

export function selectDashboardMetrics(available: string[], preferred: readonly string[]) {
  const eligible = [...new Set(available)].filter((metric) => !dashboardBreakdownMetrics.includes(metric));
  const rank = (metric: string) => { const index = metricPriority.indexOf(metric); return index < 0 ? metricPriority.length : index; };
  const ordered = eligible.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return [...new Set([...preferred.filter((metric) => eligible.includes(metric)), ...ordered])].slice(0, 6);
}

function accumulator(): RollupAccumulator { return { sum: 0, count: 0, latestDate: '', latestValue: 0 }; }
function metricCurrency(dimensionsJson: string) {
  try {
    const value = JSON.parse(dimensionsJson) as { currency?: unknown };
    return typeof value.currency === 'string' && /^[a-z]{3}$/i.test(value.currency) ? value.currency.toLowerCase() : null;
  } catch { return null; }
}

export function aggregateDashboardRows(points: DashboardSummaryPoint[], split: string): DashboardSummaryRow[] {
  const aggregates = new Map<string, { productId: string; metric: string; currency: string | null; current: RollupAccumulator; previous: RollupAccumulator }>();
  for (const point of points) {
    const currency = metricCurrency(point.dimensionsJson);
    const key = JSON.stringify([point.productId, point.metric, currency]);
    const aggregate = aggregates.get(key) || { productId: point.productId, metric: point.metric, currency, current: accumulator(), previous: accumulator() };
    addRollupValue(point.metricDate >= split ? aggregate.current : aggregate.previous, point.metricDate, point.value);
    aggregates.set(key, aggregate);
  }
  return [...aggregates.values()].map((value) => {
    const current = finishRollup(value.metric, value.current);
    const previous = finishRollup(value.metric, value.previous);
    return {
      productId: value.productId, metric: value.metric, currency: value.currency, current, previous,
      change: value.current.count && previous ? ((current - previous) / Math.abs(previous)) * 100 : null,
      latestDate: value.current.latestDate, currentCount: value.current.count, previousCount: value.previous.count,
    };
  });
}

export function buildDashboardMetricCards(metrics: string[], rows: DashboardSummaryRow[]) {
  return metrics.flatMap((metric) => {
    // A prior-period-only currency is missing current evidence, not a zero-valued KPI.
    const currencies = [...new Set(rows.filter((row) => row.metric === metric && row.currentCount > 0).map((row) => row.currency))];
    return currencies.map((currency) => {
      const matching = rows.filter((row) => row.metric === metric && row.currency === currency);
      const combine = (period: 'current' | 'previous') => {
        const observed = matching.filter((row) => row[period === 'current' ? 'currentCount' : 'previousCount'] > 0);
        const sum = observed.reduce((total, row) => total + row[period], 0);
        return metricRollup(metric) === 'average' && observed.length ? sum / observed.length : sum;
      };
      const current = combine('current'); const previous = combine('previous');
      return { metric, currency, current, change: previous ? ((current - previous) / Math.abs(previous)) * 100 : null };
    });
  }).slice(0, 6);
}

export function humanize(value: string, locale: DashboardLocale) { const labels: Record<string, string> = { active_users: '活跃用户', users: '用户数', revenue: '收入', mrr: '月度经常性收入', paid_customers: '付费客户', clicks: '点击数', impressions: '展示次数', requests: '请求数', errors: '错误数', repo_stars: '仓库星标', repo_commits: '代码提交' }; if (locale === 'zh' && labels[value]) return labels[value]; return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()); }
export function formatMetric(metric: string, value: number, currency: string | null = null, locale: DashboardLocale = 'en') { const numberLocale = locale === 'zh' ? 'zh-CN' : 'en-US'; if (metric.includes('revenue') || metric === 'mrr' || metric === 'refunds') return currency ? new Intl.NumberFormat(numberLocale, { style: 'currency', currency: currency.toUpperCase(), notation: Math.abs(value) >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value) : `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(value)}${locale === 'zh' ? '（未设置币种）' : ' (currency unset)'}`; if (metric === 'ctr' || metric.includes('rate')) return `${(value * (value <= 1 ? 100 : 1)).toFixed(1)}%`; if (metric.endsWith('_bytes')) return formatBytes(value, numberLocale); if (metric.endsWith('_duration_ms')) return formatDuration(value, locale); if (metric.includes('cpu') || metric.includes('time') || metric === 'position') return value.toFixed(2); return new Intl.NumberFormat(numberLocale, { notation: Math.abs(value) >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value); }
export function formatBytes(value: number, numberLocale: string) { const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']; let amount = Math.max(0, value); let unit = 0; while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; } return `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: amount < 10 && unit ? 2 : 1 }).format(amount)} ${units[unit]}`; }
export function formatDuration(value: number, locale: DashboardLocale) { const seconds = Math.max(0, value) / 1000; return seconds < 60 ? `${seconds.toFixed(seconds < 10 ? 1 : 0)}${locale === 'zh' ? ' 秒' : ' s'}` : `${(seconds / 60).toFixed(seconds < 600 ? 1 : 0)}${locale === 'zh' ? ' 分钟' : ' min'}`; }
