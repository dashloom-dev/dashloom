import assert from 'node:assert/strict';
import test from 'node:test';
import { comparisonWindow } from '../lib/analysis-window.ts';

test('scheduled Agent runs use cadence-matched comparison windows', () => {
  assert.deepEqual(comparisonWindow('daily'), { days: 1, startOffset: -2, splitOffset: -1, currentEndOffset: -1, previousEndOffset: -2 });
  assert.deepEqual(comparisonWindow('weekly'), { days: 7, startOffset: -14, splitOffset: -7, currentEndOffset: -1, previousEndOffset: -8 });
  assert.deepEqual(comparisonWindow('monthly'), { days: 30, startOffset: -60, splitOffset: -30, currentEndOffset: -1, previousEndOffset: -31 });
});

test('interactive, manual, and alert analysis retain the seven-day comparison', () => {
  for (const trigger of ['chat', 'manual', 'alert'] as const) assert.equal(comparisonWindow(trigger).days, 7);
  assert.deepEqual(comparisonWindow('chat'), { days: 7, startOffset: -13, splitOffset: -6, currentEndOffset: 0, previousEndOffset: -7 });
});
