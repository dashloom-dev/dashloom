import assert from 'node:assert/strict';
import test from 'node:test';
import { addRollupValue, finishRollup, metricRollup, type RollupAccumulator } from '../lib/metric-rollup.ts';

function roll(metric: string, values: Array<[string, number]>) {
  const accumulator: RollupAccumulator = { sum: 0, count: 0, latestDate: '', latestValue: 0 };
  for (const [date, value] of values) addRollupValue(accumulator, date, value);
  return finishRollup(metric, accumulator);
}

test('metric semantics keep flows additive, stocks latest, and ratios averaged', () => {
  const values: Array<[string, number]> = [['2026-08-24', 10], ['2026-08-26', 30], ['2026-08-25', 20]];
  assert.equal(metricRollup('revenue'), 'sum');
  assert.equal(roll('revenue', values), 60);
  assert.equal(metricRollup('mrr'), 'latest');
  assert.equal(roll('mrr', values), 30);
  assert.equal(metricRollup('repo_stars'), 'latest');
  assert.equal(roll('repo_stars', values), 30);
  assert.equal(metricRollup('conversion_rate'), 'average');
  assert.equal(roll('conversion_rate', values), 20);
  assert.equal(metricRollup('vercel_deployment_duration_ms'), 'average');
  assert.equal(metricRollup('vercel_last_completed_deployment_success'), 'latest');
});
