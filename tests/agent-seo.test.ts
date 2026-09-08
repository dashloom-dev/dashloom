import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSeoOpportunities, type SeoSeries } from '../lib/agent-seo.ts';

function row(metric: string, current: number, previous = current, overrides: Partial<SeoSeries> = {}): SeoSeries {
  return { productId: 'one', source: 'gsc', metric: `query_${metric}`, dimension: { type: 'query', label: 'image editor' }, current, previous, currentSamples: 7, previousSamples: 7, evidenceId: `metric:${metric}`, ...overrides };
}

test('SEO shortlist derives three signals and original citations from measured evidence', () => {
  const result = buildSeoOpportunities([row('clicks', 8, 20), row('impressions', 1000), row('position', 8)]);
  assert.deepEqual(result.candidates[0].signals.map((s) => s.kind), ['high_impressions_low_ctr', 'striking_distance', 'click_decline']);
  assert.equal(result.candidates[0].observedCtr, 0.008);
  assert.deepEqual(new Set(result.candidates[0].evidenceRefs), new Set(['metric:clicks', 'metric:impressions', 'metric:position']));
});

test('missing and partial periods never become measured declines', () => {
  for (const samples of [0, 1, 6]) {
    assert.equal(buildSeoOpportunities([row('clicks', 0, 20, { currentSamples: samples })]).candidateCount, 0);
    assert.equal(buildSeoOpportunities([row('clicks', 0, 20, { previousSamples: samples })]).candidateCount, 0);
  }
  assert.equal(buildSeoOpportunities([row('clicks', 0, 20)]).candidateCount, 1);
  assert.equal(buildSeoOpportunities([row('clicks', 0, 20, { currentSamples: 1, previousSamples: 1 })], 1).candidateCount, 1);
});

test('products, providers and query/page dimensions never cross-join', () => {
  for (const overrides of [{ productId: 'two' }, { source: 'other' }, { dimension: { type: 'page' as const, label: 'image editor' }, metric: 'page_impressions' }]) {
    assert.equal(buildSeoOpportunities([row('clicks', 1), row('impressions', 1000, 1000, overrides)]).candidateCount, 0);
  }
});

test('invalid values, low sample volume and positions outside the heuristic are excluded', () => {
  for (const value of [NaN, Infinity, -1, 3, 21]) {
    assert.equal(buildSeoOpportunities([row('impressions', 1000), row('position', value)]).candidateCount, 0);
  }
  assert.equal(buildSeoOpportunities([row('impressions', 99), row('position', 8), row('clicks', 0)]).candidateCount, 0);
  assert.equal(buildSeoOpportunities([row('impressions', 100), row('clicks', 200)]).candidateCount, 0);
});

test('candidate output is bounded and discloses omitted candidates', () => {
  const result = buildSeoOpportunities(Array.from({ length: 20 }, (_, i) => row('clicks', 0, 20, { dimension: { type: 'query', label: `query ${i}` } })));
  assert.equal(result.candidates.length, 12);
  assert.equal(result.candidateCount, 20);
  assert.equal(result.truncated, true);
});
