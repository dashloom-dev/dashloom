import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAgentActionDigest } from '../lib/report-action-digest.ts';

test('report action digest makes priority, recurrence, state, and deadlines explicit', () => {
  const digest = formatAgentActionDigest([{ title: 'Repair checkout', recommendedAction: 'Inspect webhook failures.', severity: 'critical', status: 'in_progress', occurrenceCount: 3, dueAt: '2026-08-25T23:59:59.000Z' }], new Date('2026-08-26T12:00:00.000Z'));
  assert.match(digest, /\[CRITICAL\] Repair checkout/);
  assert.match(digest, /in progress · seen 3× · overdue since 2026-08-25/);
  assert.match(digest, /Inspect webhook failures/);
});

test('report action digest has a truthful empty state', () => {
  assert.match(formatAgentActionDigest([]), /No open Agent actions/);
});
