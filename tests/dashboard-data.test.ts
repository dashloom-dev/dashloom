import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('dashboard loading excludes only bounded GSC breakdown rows and retains GA4 page views', () => {
  const source = readFileSync(new URL('../lib/dashboard-data.ts', import.meta.url), 'utf8');
  assert.match(source, /dashboardBreakdownMetrics = \['query_clicks', 'query_impressions', 'query_position', 'page_clicks', 'page_impressions', 'page_position'\]/);
  assert.match(source, /notInArray\(metricPoints\.metric, dashboardBreakdownMetrics\)/);
  assert.doesNotMatch(source, /glob 'page_\*'/);
  assert.doesNotMatch(source, /['"]page_views['"][,\]]/);
});
