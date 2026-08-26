import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeAgentReadiness } from '../lib/agent-catalog.ts';

const rows = [
  { metric: 'requests', source: 'cloudflare', dimensionsJson: '{}', metricDate: '2026-08-26' },
  { metric: 'revenue', source: 'stripe', dimensionsJson: '{"currency":"usd"}', metricDate: '2026-08-25' },
  { metric: 'pipeline_value', source: 'custom', dimensionsJson: '{"domain":"commercial"}', metricDate: '2026-08-24' },
  { metric: 'queue_backlog_messages', source: 'cloudflare_queues', dimensionsJson: '{"truncated":true}', metricDate: '2026-08-26' },
];

test('Agent readiness is specialist-specific and honors validated custom domains', () => {
  const readiness = summarizeAgentReadiness(rows);
  assert.equal(readiness.portfolio_analyst.eligiblePointCount, 4);
  assert.equal(readiness.operations_analyst.eligiblePointCount, 2);
  assert.equal(readiness.revenue_analyst.eligiblePointCount, 2);
  assert.equal(readiness.seo_growth_analyst.ready, false);
});

test('competitor evidence follows the same specialist metric policy', () => {
  const competitorRows = Array.from({ length: 4 }, () => ({ metric: 'clicks', source: 'manual', dimensionsJson: '{}', metricDate: '2026-08-26' }));
  const readiness = summarizeAgentReadiness([], competitorRows);
  assert.equal(readiness.portfolio_analyst.ready, true);
  assert.equal(readiness.seo_growth_analyst.ready, true);
  assert.equal(readiness.client_reporting_analyst.ready, true);
  assert.equal(readiness.revenue_analyst.ready, false);
  assert.equal(readiness.operations_analyst.ready, false);
});

test('malformed custom dimensions cannot claim a specialist domain', () => {
  const readiness = summarizeAgentReadiness([{ metric: 'unknown_metric', source: 'custom', dimensionsJson: '{bad', metricDate: '2026-08-26' }]);
  assert.equal(readiness.portfolio_analyst.ready, true);
  assert.equal(readiness.revenue_analyst.ready, false);
});
