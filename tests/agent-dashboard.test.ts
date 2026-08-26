import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgentDashboardDefinition } from '../lib/agent-dashboard-policy.ts';

const finding = { title: 'Revenue accelerated', detail: 'Revenue increased on cited product evidence.', severity: 'opportunity' as const, metric: 'revenue', productId: '11111111-1111-4111-8111-111111111111', currentValue: 120, previousValue: 100, changePercent: 20, action: 'Verify the highest-converting channel.', confidence: 0.9, evidenceRefs: ['metric:product:stripe:revenue:usd'] };

test('Agent dashboard maps each specialist to its decision template and finding metrics', () => {
  const dashboard = buildAgentDashboardDefinition('revenue_analyst', { summary: 'Commercial momentum improved with one evidence-backed follow-up.', findings: [finding] }, '2026-08-26T10:00:00Z');
  assert.equal(dashboard.preset, 'saas_revenue');
  assert.equal(dashboard.productId, finding.productId);
  assert.equal(dashboard.configuration.metrics?.[0], 'revenue');
  assert.match(dashboard.name, /Revenue Analyst/);
});

test('all five specialists map to the intended public dashboard taxonomy', () => {
  const expected = { portfolio_analyst: 'indie_hacker', revenue_analyst: 'saas_revenue', seo_growth_analyst: 'seo_growth', operations_analyst: 'cloudflare_operations', client_reporting_analyst: 'agency_client' } as const;
  for (const [preset, dashboardPreset] of Object.entries(expected)) assert.equal(buildAgentDashboardDefinition(preset as keyof typeof expected, { summary: 'A bounded evidence-backed specialist summary.', findings: [finding] }, '2026-08-26T10:00:00Z').preset, dashboardPreset);
});

test('Agent dashboard removes unsafe metric names and avoids false product scope', () => {
  const dashboard = buildAgentDashboardDefinition('portfolio_analyst', { summary: 'Two products moved in different directions.', findings: [finding, { ...finding, metric: 'revenue;drop table', productId: '22222222-2222-4222-8222-222222222222' }] }, '2026-08-26T10:00:00Z');
  assert.equal(dashboard.productId, null);
  assert.equal(dashboard.configuration.metrics?.includes('revenue;drop table'), false);
  assert.ok((dashboard.configuration.metrics?.length || 0) <= 8);
});

test('one unscoped finding keeps the smart dashboard portfolio-wide', () => {
  const dashboard = buildAgentDashboardDefinition('portfolio_analyst', { summary: 'Portfolio context accompanies one product-specific finding.', findings: [finding, { ...finding, productId: null }] }, '2026-08-26T10:00:00Z');
  assert.equal(dashboard.productId, null);
});
