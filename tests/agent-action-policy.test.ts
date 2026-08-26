import assert from 'node:assert/strict';
import test from 'node:test';
import { agentActionFingerprint, agentActionStatusAfterRecurrence, canTransitionAgentAction, normalizedActionIdentity } from '../lib/agent-action-policy.ts';

test('Agent action lifecycle permits deliberate planning, completion, dismissal, and reopening', () => {
  assert.equal(canTransitionAgentAction('suggested', 'planned'), true);
  assert.equal(canTransitionAgentAction('suggested', 'done'), false);
  assert.equal(canTransitionAgentAction('planned', 'done'), true);
  assert.equal(canTransitionAgentAction('done', 'in_progress'), true);
  assert.equal(canTransitionAgentAction('dismissed', 'planned'), true);
  assert.equal(canTransitionAgentAction('dismissed', 'done'), false);
});

test('completed work resurfaces when the same evidence-backed recommendation recurs', () => {
  assert.equal(agentActionStatusAfterRecurrence('done'), 'suggested');
  assert.equal(agentActionStatusAfterRecurrence('dismissed'), 'dismissed');
  assert.equal(agentActionStatusAfterRecurrence('in_progress'), 'in_progress');
});

test('Agent action identity is stable but remains product scoped', async () => {
  const first = { productId: 'p1', title: ' Fix checkout ', action: 'Inspect   failed webhooks.' };
  const equivalent = { productId: 'p1', title: 'fix checkout', action: 'inspect failed webhooks.' };
  assert.equal(normalizedActionIdentity(first), normalizedActionIdentity(equivalent));
  assert.equal(await agentActionFingerprint(first), await agentActionFingerprint(equivalent));
  assert.notEqual(await agentActionFingerprint(first), await agentActionFingerprint({ ...equivalent, productId: 'p2' }));
});
