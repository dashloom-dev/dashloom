import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgentRadar, radarSpecialist, type RadarEvidence } from '../lib/agent-radar.ts';

const evidence: RadarEvidence = {
  periods: { current: { start: '2026-08-19', end: '2026-08-25' }, previous: { start: '2026-08-12', end: '2026-08-18' } },
  products: [{ id: 'product-1', name: 'Northstar' }],
  freshness: '2026-08-25',
  series: [
    { productId: 'product-1', productName: 'Northstar', source: 'stripe', metric: 'revenue', currency: 'usd', current: 60, previous: 100, changePercent: -40, latestDate: '2026-08-25', evidenceId: 'metric:product-1:stripe:revenue:usd' },
    { productId: 'product-1', productName: 'Northstar', source: 'gsc', metric: 'clicks', currency: null, current: 130, previous: 100, changePercent: 30, latestDate: '2026-08-25', evidenceId: 'metric:product-1:gsc:clicks' },
    { productId: 'product-1', productName: 'Northstar', source: 'cloudflare', metric: 'requests', currency: null, current: 105, previous: 100, changePercent: 5, latestDate: '2026-08-25', evidenceId: 'metric:product-1:cloudflare:requests' },
  ],
  crossSignals: [],
  healthScores: [{ evidenceId: 'health:product-1', productId: 'product-1', productName: 'Northstar', score: 42, status: 'risk', reasons: ['Error rate is 7.0%.'], freshness: '2026-08-25' }],
  goals: [{ evidenceId: 'goal:goal-1', productId: 'product-1', productName: 'Northstar', name: 'Monthly revenue', metric: 'revenue', source: 'stripe', currency: 'usd', targetValue: 500, currentValue: 200, progressPercent: 40, status: 'off_track', period: 'monthly', periodStart: '2026-07-27', periodEnd: '2026-08-25' }],
  missions: [],
};

test('Signal Radar ranks deterministic risks and routes metrics to specialists', () => {
  const radar = buildAgentRadar(evidence);
  assert.equal(radar.counts.risk, 3);
  assert.equal(radar.counts.opportunity, 1);
  assert.equal(radar.counts.watch, 0);
  assert.equal(radar.signals.some((signal) => signal.metric === 'requests'), false);
  const revenue = radar.signals.find((signal) => signal.kind === 'metric_change' && signal.metric === 'revenue');
  assert.equal(revenue?.tone, 'risk');
  assert.equal(revenue?.preset, 'revenue_analyst');
  assert.match(revenue?.question || '', /metric:product-1:stripe:revenue:usd/);
  const clicks = radar.signals.find((signal) => signal.metric === 'clicks');
  assert.equal(clicks?.tone, 'opportunity');
  assert.equal(clicks?.preset, 'seo_growth_analyst');
});

test('Signal Radar respects materiality and custom metric domains', () => {
  assert.equal(radarSpecialist('qualified_pipeline', 'commercial'), 'revenue_analyst');
  assert.equal(radarSpecialist('crawl_coverage', 'search'), 'seo_growth_analyst');
  assert.equal(radarSpecialist('queue_depth_custom', 'operations'), 'operations_analyst');
  assert.equal(radarSpecialist('feature_adoption', 'product'), 'portfolio_analyst');
  const radar = buildAgentRadar(evidence, { thresholdPercent: 35 });
  assert.equal(radar.signals.some((signal) => signal.metric === 'clicks'), false);
  assert.equal(radar.signals.some((signal) => signal.metric === 'revenue'), true);
});

test('Signal Radar never promotes co-movement into causal evidence', () => {
  const radar = buildAgentRadar({ ...evidence, series: [], healthScores: [], goals: [], crossSignals: [{ evidenceId: 'relationship:one', productId: 'product-1', productName: 'Northstar', pattern: 'same_direction', left: { ...evidence.series[0], category: 'commercial' }, right: { ...evidence.series[1], category: 'search' }, evidenceRefs: ['metric:product-1:stripe:revenue:usd', 'metric:product-1:gsc:clicks'], caution: 'This is deterministic co-movement evidence, not proof that either signal caused the other.', score: 70 }] });
  assert.equal(radar.signals[0]?.tone, 'watch');
  assert.match(radar.signals[0]?.limitation || '', /not proof/i);
  assert.deepEqual(radar.signals[0]?.evidenceRefs, ['relationship:one', 'metric:product-1:stripe:revenue:usd', 'metric:product-1:gsc:clicks']);
});
