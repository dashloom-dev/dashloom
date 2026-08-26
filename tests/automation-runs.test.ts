import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { automationErrorCode, scheduledExecutionKey, summarizeAutomationResults } from '../lib/automation-run-policy.ts';

describe('automation run safety', () => {
  it('uses cron and scheduled time as a stable at-least-once execution key', () => { assert.equal(scheduledExecutionKey('*/15 * * * *', 123), scheduledExecutionKey('*/15 * * * *', 123)); assert.notEqual(scheduledExecutionKey('*/15 * * * *', 124), scheduledExecutionKey('*/15 * * * *', 123)); });
  it('classifies complete, partial, and failed executions', () => { assert.equal(summarizeAutomationResults(['a'], [{ status: 'fulfilled', value: {} }]).status, 'success'); assert.equal(summarizeAutomationResults(['a', 'b'], [{ status: 'fulfilled', value: {} }, { status: 'rejected', reason: new Error('secret') }]).status, 'partial'); assert.equal(summarizeAutomationResults(['a'], [{ status: 'rejected', reason: new Error('secret') }]).status, 'error'); });
  it('persists stable codes without leaking provider errors', () => { const summary = summarizeAutomationResults(['sync and alerts'], [{ status: 'rejected', reason: new Error('sk-live-secret') }]); assert.deepEqual(summary.tasks, [{ name: 'sync and alerts', status: 'error', errorCode: 'SYNC_AND_ALERTS_FAILED' }]); assert.equal(JSON.stringify(summary).includes('sk-live-secret'), false); assert.equal(automationErrorCode(''), 'TASK_FAILED'); });
});
