import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReportScheduleBatchSucceeded, reportScheduleErrorCode, reportScheduleOccurrenceAt, reportScheduleRetryAt } from '../lib/report-schedule-policy.ts';

test('scheduled report failures expose stable operational codes', () => {
  assert.equal(reportScheduleErrorCode(new Error('Connect a validated AI provider before running analysis.')), 'MODEL_UNAVAILABLE');
  assert.equal(reportScheduleErrorCode(new Error('Sync evidence supported by Revenue Analyst before running analysis.')), 'EVIDENCE_UNAVAILABLE');
  assert.equal(reportScheduleErrorCode(new Error('Scheduled report delivery failed.')), 'DELIVERY_FAILED');
  assert.equal(reportScheduleErrorCode(new Error('private provider response')), 'MODEL_UNAVAILABLE');
  assert.equal(reportScheduleErrorCode(new Error('unexpected')), 'REPORT_GENERATION_FAILED');
});

test('scheduled report retries back off from fifteen minutes and cap at six hours', () => {
  const now = new Date('2026-08-26T00:00:00.000Z');
  assert.equal(reportScheduleRetryAt(1, now), '2026-08-26T00:15:00.000Z');
  assert.equal(reportScheduleRetryAt(3, now), '2026-08-26T01:00:00.000Z');
  assert.equal(reportScheduleRetryAt(99, now), '2026-08-26T06:00:00.000Z');
});

test('a failed schedule marks the outer automation task as failed', () => {
  assert.doesNotThrow(() => assertReportScheduleBatchSucceeded([]));
  assert.doesNotThrow(() => assertReportScheduleBatchSucceeded([{ status: 'ready' }, { status: 'delivered' }]));
  assert.throws(() => assertReportScheduleBatchSucceeded([{ status: 'ready' }, { status: 'error' }]));
});

test('schedule retries preserve the original occurrence identity', () => {
  assert.equal(reportScheduleOccurrenceAt(null, '2026-08-26T08:00:00.000Z'), '2026-08-26T08:00:00.000Z');
  assert.equal(reportScheduleOccurrenceAt('2026-08-26T08:00:00.000Z', '2026-08-26T08:15:00.000Z'), '2026-08-26T08:00:00.000Z');
});
