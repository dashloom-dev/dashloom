import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTION_OUTCOME_LIMITATION, assessActionOutcome, metricChangePercent, metricOutcomeDirection } from '../lib/agent-action-outcome-policy.ts';
import { actionBaselineCutoff, selectLatestActionMeasurement } from '../lib/agent-action-outcome-measurement.ts';

test('action outcomes use explicit operating direction instead of assuming every increase is good', () => {
  assert.equal(metricOutcomeDirection('revenue'), 'increase_good');
  assert.equal(metricOutcomeDirection('error_rate'), 'decrease_good');
  assert.equal(metricOutcomeDirection('requests'), 'contextual');
  assert.equal(assessActionOutcome('increase_good', 100, 120), 'improved');
  assert.equal(assessActionOutcome('decrease_good', 10, 4), 'improved');
  assert.equal(assessActionOutcome('decrease_good', 10, 14), 'regressed');
  assert.equal(assessActionOutcome('contextual', 100, 120), 'changed');
});

test('action outcome measurements keep source and currency boundaries', () => {
  const rows = [
    { source: 'stripe', metricDate: '2026-08-27', value: 20, dimensionsJson: '{"currency":"usd"}' },
    { source: 'stripe', metricDate: '2026-08-27', value: 30, dimensionsJson: '{"currency":"eur"}' },
    { source: 'stripe', metricDate: '2026-08-26', value: 10, dimensionsJson: '{"currency":"usd"}' },
    { source: 'custom', metricDate: '2026-08-28', value: 999, dimensionsJson: '{"currency":"usd","connector":"abc12345"}' },
  ];
  assert.deepEqual(selectLatestActionMeasurement(rows, { source: 'stripe', metric: 'revenue', currency: 'usd' }), { metricDate: '2026-08-27', value: 20 });
  assert.deepEqual(selectLatestActionMeasurement(rows, { source: 'custom:abc12345', metric: 'revenue', currency: 'usd' }), { metricDate: '2026-08-28', value: 999 });
  assert.match(ACTION_OUTCOME_LIMITATION, /not proof/);
  assert.equal(actionBaselineCutoff('revenue', '2026-08-27T12:00:00Z'), '2026-08-26');
  assert.equal(actionBaselineCutoff('mrr', '2026-08-27T12:00:00Z'), '2026-08-27');
});

test('action outcomes preserve uncertainty around zero and immaterial movement', () => {
  assert.equal(metricChangePercent(0, 10), null);
  assert.equal(assessActionOutcome('increase_good', 100, 100.5), 'unchanged');
  assert.equal(assessActionOutcome('increase_good', 0, 0), 'unchanged');
  assert.equal(assessActionOutcome('increase_good', 0, 1), 'improved');
});
