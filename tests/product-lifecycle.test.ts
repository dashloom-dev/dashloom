import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductSlug, normalizeProductDomain, productDeletionConfirmed, summarizeProductDeletionImpact, type ProductDeletionCounts } from '../lib/product-lifecycle.ts';

const emptyCounts: ProductDeletionCounts = {
  connectorMappings: 0,
  metricPoints: 0,
  goals: 0,
  competitors: 0,
  competitorMetricPoints: 0,
  dashboardViews: 0,
  reportSchedules: 0,
  ingestionKeys: 0,
  conversations: 0,
  executiveBriefs: 0,
  agentActions: 0,
  actionOutcomes: 0,
  growthMissions: 0,
  reports: 0,
};

test('product fields normalize consistently for create and edit', () => {
  assert.equal(normalizeProductDomain(' HTTPS://Example.COM/path/// '), 'example.com/path');
  assert.equal(normalizeProductDomain('  '), null);
  assert.equal(buildProductSlug(' Nimbus Analytics 2.0 '), 'nimbus-analytics-2-0');
  assert.equal(buildProductSlug('产品'), 'product');
});

test('deletion impact separates cascaded operational data from detached history', () => {
  const impact = summarizeProductDeletionImpact({ ...emptyCounts, connectorMappings: 2, metricPoints: 50, conversations: 3, reports: 4 });
  assert.equal(impact.deletedTotal, 52);
  assert.equal(impact.detachedTotal, 7);
  assert.deepEqual(impact.deleted.find((item) => item.key === 'metricPoints'), { key: 'metricPoints', label: 'metric points', count: 50 });
  assert.deepEqual(impact.detached.find((item) => item.key === 'reports'), { key: 'reports', label: 'historical reports', count: 4 });
});

test('permanent deletion confirmation is deliberately exact', () => {
  assert.equal(productDeletionConfirmed('Nimbus', 'Nimbus'), true);
  assert.equal(productDeletionConfirmed('Nimbus', 'nimbus'), false);
  assert.equal(productDeletionConfirmed('Nimbus', 'Nimbus '), false);
});
