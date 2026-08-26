import assert from 'node:assert/strict';
import test from 'node:test';
import { agentMetricAllowed } from '../lib/agent-metric-policy.ts';

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
