import assert from 'node:assert/strict';
import test from 'node:test';
import { gscSearchAnalyticsPoints } from '../lib/google-search-console-metrics.ts';

test('GSC query rows preserve the query label as granular metric evidence', () => {
  const points = gscSearchAnalyticsPoints([{ keys: ['2026-08-31', 'play spyro online'], clicks: 12, impressions: 240, ctr: 0.05, position: 8.5 }], 'query', false, '2026-09-01T00:00:00.000Z');
  assert.deepEqual(points.map(({ metric, value }) => [metric, value]), [['query_clicks', 12], ['query_impressions', 240], ['query_position', 8.5]]);
  assert.equal(points[0]?.dimensionsJson, '{"query":"play spyro online"}');
});

test('GSC page rows disclose a bounded collection', () => {
  const points = gscSearchAnalyticsPoints([{ keys: ['2026-08-31', 'https://example.com/spyro'], clicks: 3, impressions: 90, position: 14 }], 'page', true, '2026-09-01T00:00:00.000Z');
  assert.match(points[0]?.dimensionsJson || '', /"page":"https:\/\/example.com\/spyro"/);
  assert.match(points[0]?.dimensionsJson || '', /"truncated":true/);
});
