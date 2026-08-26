import assert from 'node:assert/strict';
import test from 'node:test';
import { agentTaskDuration, agentTaskRetry, parseAnalysisRequestQuestion } from '../lib/agent-task-center.ts';

test('task center recovers only a valid original Agent question', () => {
  assert.equal(parseAnalysisRequestQuestion('{"request":{"question":" What changed? "}}'), 'What changed?');
  assert.equal(parseAnalysisRequestQuestion('{"request":{"question":"x"}}'), null);
  assert.equal(parseAnalysisRequestQuestion('{bad json'), null);
});

test('failed task retry requires an active conversation, available scope, and exact prompt', () => {
  const base = { status: 'error' as const, question: 'What changed?', conversationId: 'conversation', conversationActive: true, scopeAvailable: true };
  assert.equal(agentTaskRetry(base).state, 'available');
  assert.equal(agentTaskRetry({ ...base, conversationActive: false }).state, 'unavailable');
  assert.equal(agentTaskRetry({ ...base, scopeAvailable: false }).state, 'unavailable');
  assert.equal(agentTaskRetry({ ...base, question: null }).state, 'unavailable');
  assert.equal(agentTaskRetry({ ...base, status: 'running' }).state, 'in_progress');
  assert.equal(agentTaskRetry({ ...base, status: 'success' }).state, 'not_needed');
});

test('task duration is stable for completed runs', () => {
  assert.equal(agentTaskDuration('2026-08-27T10:00:00.000Z', '2026-08-27T10:01:05.000Z'), '1m 5s');
  assert.equal(agentTaskDuration(null, null), null);
});
