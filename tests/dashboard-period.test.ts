import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardComparisonWindow } from '../lib/dashboard-period.ts';

test('dashboard comparison follows the latest matching metric date', () => {
  assert.deepEqual(dashboardComparisonWindow('2026-08-29'), { start: '2026-08-16', split: '2026-08-23', end: '2026-08-29' });
});

test('dashboard comparison crosses month and year boundaries in UTC', () => {
  assert.deepEqual(dashboardComparisonWindow('2026-01-05'), { start: '2025-12-23', split: '2025-12-30', end: '2026-01-05' });
});

test('dashboard comparison rejects missing and invalid metric dates', () => {
  assert.equal(dashboardComparisonWindow(null), null);
  assert.equal(dashboardComparisonWindow('2026-02-30'), null);
  assert.equal(dashboardComparisonWindow('not-a-date'), null);
});
