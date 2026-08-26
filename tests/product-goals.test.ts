import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateProductGoals, productGoalWindow } from '../lib/product-goals.ts';

const goals = [
  { id: 'g-revenue', productId: 'p1', productName: 'Nimbus', name: 'Revenue target', metric: 'revenue', source: 'stripe', currency: 'usd', direction: 'at_least' as const, period: 'weekly' as const, targetValue: 1000 },
  { id: 'g-error', productId: 'p1', productName: 'Nimbus', name: 'Error budget', metric: 'error_rate', source: null, currency: null, direction: 'at_most' as const, period: 'daily' as const, targetValue: 2 },
];

test('product goal windows are rolling and inclusive', () => {
  assert.deepEqual(productGoalWindow('weekly', '2026-08-26'), { start: '2026-08-20', end: '2026-08-26', days: 7 });
  assert.deepEqual(productGoalWindow('quarterly', '2026-08-26'), { start: '2026-05-29', end: '2026-08-26', days: 90 });
});

test('goals evaluate source, currency, rollup, and direction deterministically', () => {
  const result = evaluateProductGoals(goals, [
    { productId: 'p1', source: 'stripe', metric: 'revenue', metricDate: '2026-08-20', value: 400, dimensionsJson: '{"currency":"usd"}' },
    { productId: 'p1', source: 'stripe', metric: 'revenue', metricDate: '2026-08-26', value: 450, dimensionsJson: '{"currency":"USD"}' },
    { productId: 'p1', source: 'stripe', metric: 'revenue', metricDate: '2026-08-26', value: 9000, dimensionsJson: '{"currency":"eur"}' },
    { productId: 'p1', source: 'manual', metric: 'revenue', metricDate: '2026-08-26', value: 9000, dimensionsJson: '{"currency":"usd"}' },
    { productId: 'p1', source: 'cloudflare', metric: 'error_rate', metricDate: '2026-08-26', value: 2.5 },
  ], '2026-08-26');
  assert.equal(result[0].currentValue, 850);
  assert.equal(result[0].progressPercent, 85);
  assert.equal(result[0].status, 'at_risk');
  assert.equal(result[0].evidenceId, 'goal:g-revenue');
  assert.equal(result[1].currentValue, 2.5);
  assert.equal(result[1].progressPercent, 80);
  assert.equal(result[1].status, 'at_risk');
  assert.equal(result[1].rollup, 'average');
});

test('goals distinguish achieved, off-track, and missing data', () => {
  const result = evaluateProductGoals([
    ...goals,
    { id: 'g-missing', productId: 'p2', productName: 'Pulse', name: 'Sessions', metric: 'sessions', source: null, currency: null, direction: 'at_least' as const, period: 'monthly' as const, targetValue: 100 },
  ], [
    { productId: 'p1', source: 'stripe', metric: 'revenue', metricDate: '2026-08-26', value: 1000, dimensionsJson: '{"currency":"usd"}' },
    { productId: 'p1', source: 'cloudflare', metric: 'error_rate', metricDate: '2026-08-26', value: 8 },
  ], '2026-08-26');
  assert.equal(result[0].status, 'achieved');
  assert.equal(result[1].status, 'off_track');
  assert.equal(result[2].status, 'no_data');
  assert.equal(result[2].currentValue, null);
});
