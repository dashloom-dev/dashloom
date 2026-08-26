import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeAgentReadiness } from '../lib/agent-catalog.ts';
import { buildProductDataCoverage } from '../lib/product-data-coverage.ts';

test('product coverage distinguishes live, awaiting, stale, and attention sources', () => {
  const readiness = summarizeAgentReadiness([{ metric: 'requests', source: 'cloudflare', dimensionsJson: '{}', metricDate: '2026-08-25', pointCount: 4 }]);
  const result = buildProductDataCoverage({ productId: 'p1', now: new Date('2026-08-26T12:00:00Z'), readiness, mappings: [
    { productId: 'p1', source: 'cloudflare', enabled: true, accountStatus: 'connected' },
    { productId: 'p1', source: 'stripe', enabled: true, accountStatus: 'connected' },
    { productId: 'p1', source: 'github', enabled: true, accountStatus: 'attention' },
  ], evidence: [
    { productId: 'p1', source: 'cloudflare', pointCount: 4, metricCount: 2, latestDate: '2026-08-25' },
    { productId: 'p1', source: 'manual', pointCount: 1, metricCount: 1, latestDate: '2026-08-01' },
  ] });
  assert.equal(result.status, 'live');
  assert.equal(result.sources.find((item) => item.source === 'cloudflare')?.state, 'fresh');
  assert.equal(result.sources.find((item) => item.source === 'stripe')?.state, 'awaiting_sync');
  assert.equal(result.sources.find((item) => item.source === 'github')?.state, 'attention');
  assert.equal(result.sources.find((item) => item.source === 'manual')?.state, 'stale');
  assert.equal(result.pointCount, 5);
});

test('product without mappings or evidence is truthfully not connected', () => {
  const result = buildProductDataCoverage({ productId: 'p2', mappings: [], evidence: [], readiness: summarizeAgentReadiness([]) });
  assert.equal(result.status, 'not_connected');
  assert.equal(result.readyAgents.length, 0);
});
