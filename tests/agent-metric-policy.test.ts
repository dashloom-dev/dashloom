import assert from 'node:assert/strict';
import test from 'node:test';
import { agentMetricAllowed, agentQueryableMetrics } from '../lib/agent-metric-policy.ts';
import { agentAllowedMetrics } from '../lib/agent-catalog.ts';

test('custom metric domains route evidence to the matching specialist', () => {
  assert.equal(agentMetricAllowed('revenue_analyst', ['mrr'], 'qualified_pipeline', 'commercial'), true);
  assert.equal(agentMetricAllowed('seo_growth_analyst', ['clicks'], 'brand_visibility', 'search'), true);
  assert.equal(agentMetricAllowed('operations_analyst', ['errors'], 'queue_depth', 'operations'), true);
  assert.equal(agentMetricAllowed('operations_analyst', ['errors'], 'queue_backlog_messages', null), true);
});

test('specialists reject unrelated unknown metrics while broad agents keep them', () => {
  assert.equal(agentMetricAllowed('revenue_analyst', ['mrr'], 'queue_depth', 'operations'), false);
  assert.equal(agentMetricAllowed('portfolio_analyst', [], 'activation_depth', 'product'), true);
  assert.equal(agentMetricAllowed('client_reporting_analyst', [], 'custom_kpi', null), true);
});

test('SEO specialists receive query and page breakdown metrics', () => {
  assert.equal(agentMetricAllowed('seo_growth_analyst', ['clicks', 'impressions', 'position'], 'query_clicks', null), true);
  assert.equal(agentMetricAllowed('seo_growth_analyst', ['clicks', 'impressions', 'position'], 'page_impressions', null), true);
  assert.equal(agentMetricAllowed('seo_growth_analyst', ['clicks', 'impressions', 'position'], 'query_position', null), true);
});

test('database metric queries include dimension-prefixed specialist metrics', () => {
  const queryable = agentQueryableMetrics(['clicks', 'impressions', 'position']);
  assert.ok(queryable.includes('query_clicks'));
  assert.ok(queryable.includes('page_impressions'));
  assert.ok(queryable.includes('query_position'));
});

test('Operations Agent includes delivery and backend health evidence', () => {
  const allowed = agentAllowedMetrics('operations_analyst');
  assert.ok(allowed.includes('vercel_failed_deployments'));
  assert.ok(allowed.includes('vercel_last_completed_deployment_success'));
  assert.ok(allowed.includes('pages_failed_deployments'));
  assert.ok(allowed.includes('pages_last_completed_deployment_success'));
  assert.ok(allowed.includes('supabase_project_healthy'));
});
