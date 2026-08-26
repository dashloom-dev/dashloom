import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedHistoryRanges, syncHistoryStart } from '../lib/history-window.ts';

const now = new Date('2026-08-26T12:00:00.000Z');

test('sync history covers sixty preceding days plus today', () => {
  assert.equal(syncHistoryStart(now), '2026-06-27');
  assert.deepEqual(boundedHistoryRanges(30, now), [
    { start: '2026-06-27', end: '2026-07-26' },
    { start: '2026-07-27', end: '2026-08-25' },
    { start: '2026-08-26', end: '2026-08-26' },
  ]);
});

test('bounded history rejects invalid provider limits', () => {
  assert.throws(() => boundedHistoryRanges(0, now), /positive integer/);
});
