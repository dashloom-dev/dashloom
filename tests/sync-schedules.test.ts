import assert from 'node:assert/strict';
import test from 'node:test';
import { nextSyncTime, retrySyncTime } from '../lib/sync-time.ts';

test('sync schedules advance from the claim time and cap exponential retries', () => {
  const start = new Date('2026-08-26T00:00:00.000Z');
  assert.equal(nextSyncTime(60, start), '2026-08-26T01:00:00.000Z');
  assert.equal(retrySyncTime(1, start), '2026-08-26T00:30:00.000Z');
  assert.equal(retrySyncTime(20, start), '2026-08-26T06:00:00.000Z');
});
