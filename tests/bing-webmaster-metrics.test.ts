import assert from 'node:assert/strict';
import test from 'node:test';
import { bingPagePoints, bingQueryPoints, bingTrafficPoints, parseBingDate } from '../lib/bing-webmaster-metrics.ts';

test('Bing legacy JSON dates normalize to an ISO calendar date', () => {
  assert.equal(parseBingDate('/Date(1787788800000+0000)/'), '2026-08-27');
  assert.equal(parseBingDate('2026-08-26T00:00:00Z'), '2026-08-26');
  assert.equal(parseBingDate('not-a-date'), null);
});

test('Bing traffic rows become normalized clicks, impressions, and CTR', () => {
  const points = bingTrafficPoints([{ Clicks: 25, Impressions: 100, Date: '2026-08-26T00:00:00Z' }], '2026-08-01', '2026-08-27T00:00:00Z');
  assert.deepEqual(points.map(({ metric, value }) => [metric, value]), [['clicks', 25], ['impressions', 100], ['ctr', 0.25]]);
});

test('Bing query rows keep query dimensions separate from aggregate search metrics', () => {
  const points = bingQueryPoints([{ Query: 'dashloom analytics', Clicks: 5, Impressions: 20, AvgImpressionPosition: 3.5, Date: '2026-08-26T00:00:00Z' }], '2026-08-01', '2026-08-27T00:00:00Z');
  assert.deepEqual(points.map(({ metric, value }) => [metric, value]), [['query_clicks', 5], ['query_impressions', 20], ['query_position', 3.5]]);
  assert.equal(points[0]?.dimensionsJson, '{"query":"dashloom analytics"}');
});

test('Bing page rows use page-specific metric names to avoid double counting totals', () => {
  const points = bingPagePoints([{ Query: 'https://dashloom.dev/docs', Clicks: 3, Impressions: 12, AvgClickPosition: 4, Date: '2026-08-26T00:00:00Z' }], '2026-08-01', '2026-08-27T00:00:00Z');
  assert.deepEqual(points.map(({ metric }) => metric), ['page_clicks', 'page_impressions', 'page_position']);
  assert.equal(points[0]?.dimensionsJson, '{"page":"https://dashloom.dev/docs"}');
});
