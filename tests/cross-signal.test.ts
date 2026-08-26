import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCrossSignals, type ComparableSeries } from '../lib/cross-signal.ts';

function point(metric: string, changePercent: number, currency: string | null = null): ComparableSeries { return { productId: 'product-1', productName: 'Product', source: 'test', metric, currency, current: 1, previous: 1, changePercent, evidenceId: `metric:${metric}:${currency || 'none'}` }; }

test('cross signals pair material movement across different domains', () => {
  const relationships = buildCrossSignals([point('revenue', -20, 'usd'), point('sessions', -15), point('vercel_failed_deployments', 50)]);
  assert.equal(relationships.length, 3);
  assert.ok(relationships.every((item) => item.evidenceRefs.length === 2));
  assert.ok(relationships.every((item) => item.caution.includes('not proof')));
  assert.ok(relationships.some((item) => item.pattern === 'same_direction'));
  assert.ok(relationships.some((item) => item.pattern === 'diverging'));
});

test('cross signals skip noise, same-domain pairs, and incompatible currencies', () => {
  const relationships = buildCrossSignals([point('revenue', 20, 'usd'), point('mrr', 30, 'usd'), point('refunds', 20, 'eur'), point('sessions', 5)]);
  assert.equal(relationships.length, 0);
});

test('relationship identifiers are stable for the same evidence pair', () => {
  const left = point('revenue', 20, 'usd'); const right = point('sessions', 30);
  assert.equal(buildCrossSignals([left, right])[0].evidenceId, buildCrossSignals([right, left])[0].evidenceId);
});

test('cross signals honor validated custom metric domain hints', () => {
  const custom = { ...point('activation_depth', 40), categoryHint: 'product' };
  const commercial = { ...point('qualified_pipeline', 25), categoryHint: 'commercial' };
  assert.equal(buildCrossSignals([custom, commercial]).length, 1);
});
