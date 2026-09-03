import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { aggregateDashboardRows, buildDashboardMetricCards, selectDashboardMetrics, formatMetric, humanize, type DashboardSummaryPoint } from '../lib/dashboard-summary.ts';

const split = '2026-08-04';
const point = (metric: string, value: number, overrides: Partial<DashboardSummaryPoint> = {}): DashboardSummaryPoint => ({ productId: 'a', metric, value, metricDate: '2026-09-02', dimensionsJson: '{}', ...overrides });
const cards = (metrics: string[], points: DashboardSummaryPoint[]) => buildDashboardMetricCards(metrics, aggregateDashboardRows(points, split));

test('dashboard metric selection uses available configured metrics then a stable bounded fallback', () => {
  assert.deepEqual(selectDashboardMetrics(['zeta', 'revenue', 'clicks', 'mrr', 'revenue', 'alpha'], ['missing', 'clicks']), ['clicks', 'revenue', 'mrr', 'alpha', 'zeta']);
  assert.deepEqual(selectDashboardMetrics([], ['revenue']), []);
  assert.equal(selectDashboardMetrics(['a', 'b', 'c', 'd', 'e', 'f', 'g'], []).length, 6);
  assert.deepEqual(selectDashboardMetrics(['query_clicks', 'page_impressions', 'page_views'], ['query_clicks']), ['page_views']);
});

test('dashboard flow cards separate currencies and preserve product totals and zero-valued evidence', () => {
  const result = cards(['revenue'], [
    point('revenue', 10, { dimensionsJson: '{"currency":"USD"}' }),
    point('revenue', 20, { productId: 'b', dimensionsJson: '{"currency":"usd"}' }),
    point('revenue', 15, { metricDate: '2026-08-03', dimensionsJson: '{"currency":"usd"}' }),
    point('revenue', 7, { dimensionsJson: '{"currency":"eur"}' }),
    point('revenue', 0, { dimensionsJson: 'malformed' }),
  ]);
  assert.deepEqual(result, [
    { metric: 'revenue', currency: 'usd', current: 30, change: 100 },
    { metric: 'revenue', currency: 'eur', current: 7, change: null },
    { metric: 'revenue', currency: null, current: 0, change: null },
  ]);
});

test('dashboard stock cards use each product latest observation instead of summing daily snapshots', () => {
  const rows = [point('mrr', 30), point('mrr', 10, { metricDate: '2026-08-10' }), point('mrr', 20, { metricDate: '2026-08-03' }), point('mrr', 5, { productId: 'b' })];
  assert.deepEqual(cards(['mrr'], rows), [{ metric: 'mrr', currency: null, current: 35, change: 75 }]);
  assert.deepEqual(cards(['mrr'], [...rows].reverse()), cards(['mrr'], rows));
});

test('dashboard averages do not treat products without current observations as zero', () => {
  const result = cards(['error_rate'], [
    point('error_rate', 0.1), point('error_rate', 0.3, { metricDate: '2026-08-10' }),
    point('error_rate', 0.4, { productId: 'b' }),
    point('error_rate', 0.8, { productId: 'c', metricDate: '2026-08-03' }),
  ]);
  assert.ok(Math.abs(result[0].current - 0.3) < 1e-10);
});

test('missing current metrics or currencies do not produce fake zero cards', () => {
  assert.deepEqual(cards(['revenue'], [point('revenue', 10, { metricDate: '2026-08-03' })]), []);
  const result = cards(['revenue'], [point('revenue', 1, { dimensionsJson: '{"currency":"usd"}' }), point('revenue', 10, { metricDate: '2026-08-03', dimensionsJson: '{"currency":"eur"}' })]);
  assert.equal(result.length, 1);
  assert.equal(result[0].currency, 'usd');
  assert.equal(result[0].change, null);
});

test('dashboard comparisons handle zero baselines and negative prior values without infinity', () => {
  assert.equal(cards(['revenue'], [point('revenue', 10), point('revenue', 0, { metricDate: '2026-08-03' })])[0].change, null);
  assert.equal(cards(['revenue'], [point('revenue', -5), point('revenue', -10, { metricDate: '2026-08-03' })])[0].change, 50);
});

test('shared dashboard formatting covers localized labels and operational units', () => {
  assert.equal(humanize('active_users', 'zh'), '活跃用户');
  assert.equal(formatMetric('revenue', 0, null, 'zh'), '0（未设置币种）');
  assert.match(formatMetric('revenue', 12, 'usd', 'en'), /12/);
  assert.equal(formatMetric('r2_payload_bytes', 2048), '2 KB');
  assert.equal(formatMetric('pages_deployment_duration_ms', 90000), '1.5 min');
  assert.equal(formatMetric('error_rate', 0.15), '15.0%');
});

test('overview and preset dashboard share KPI policy and preserve workspace/product scoping', () => {
  for (const file of ['../app/dashboard/page.tsx', '../app/dashboard/views/[preset]/data-dashboard.tsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /from '@\/lib\/dashboard-summary'/);
    assert.match(source, /selectDashboardMetrics\(/);
    assert.match(source, /buildDashboardMetricCards\(/);
    assert.match(source, /aggregateDashboardRows\(/);
    assert.match(source, /const metricScope = and\(eq\(metricPoints\.workspaceId, workspace\.id\)/);
    assert.match(source, /notInArray\(metricPoints\.metric, dashboardBreakdownMetrics\)/);
    assert.match(source, /eq\(metricPoints\.productId, (?:savedView|defaultDashboardView)\.productId\)/);
    assert.match(source, /max\(metricPoints\.metricDate\).*where\(metricScope\)/);
    assert.match(source, /eq\(dashboardViews\.workspaceId, workspace\.id\)/);
  }
  const overview = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.match(overview, /dashboardComparisonWindow\(latestMetricPoint\?\.metricDate, 30\)/);
  assert.doesNotMatch(overview, /sum\(\$\{metricPoints\.value\}\)/);
  assert.ok(overview.indexOf('overview-kpi-grid') < overview.indexOf('first-value-guide'));
});

test('Community capacity copy changes without importing cloud billing or changing safety guards', () => {
  const settings = readFileSync(new URL('../app/dashboard/settings/page.tsx', import.meta.url), 'utf8');
  assert.match(settings, /managed by this deployment/);
  assert.match(settings, /minute safety floor/);
  assert.match(settings, /not subscription allowances/);
  assert.doesNotMatch(settings, /\$\{workspaceProducts.length\} \/ \$\{entitlements.products\}|BillingControls|Managed AI credits/);
  for (const schema of ['../db/schema.ts', '../db/schema.pg.ts']) {
    assert.match(readFileSync(new URL(schema, import.meta.url), 'utf8'), /plan: text\('plan', \{ enum: \['community'\] \}\)/);
  }
});
