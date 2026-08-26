import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConversationHistory } from '../lib/agent-conversation.ts';

function run(index: number) {
  return {
    evidenceJson: JSON.stringify({ request: { question: `question-${index}-${'q'.repeat(600)}` }, series: [{ evidenceId: `metric:secret-${index}` }] }),
    findingsJson: JSON.stringify({
      summary: `summary-${index}-${'s'.repeat(900)}`,
      findings: Array.from({ length: 7 }, (_, finding) => ({ title: `title-${finding}-${'t'.repeat(180)}`, action: `action-${finding}-${'a'.repeat(350)}`, evidenceRefs: [`metric:secret-${index}`] })),
    }),
  };
}

test('conversation history is chronological, bounded, and strips historical evidence', () => {
  const history = buildConversationHistory([run(5), run(4), run(3), run(2), run(1)]);
  assert.equal(history.length, 4);
  assert.match(history[0].question, /^question-2-/);
  assert.match(history[3].question, /^question-5-/);
  assert.equal(history[0].question.length, 500);
  assert.equal(history[0].summary.length, 800);
  assert.equal(history[0].findings.length, 5);
  assert.ok(history[0].findings.every((finding) => finding.title.length <= 160 && finding.action.length <= 300));
  assert.doesNotMatch(JSON.stringify(history), /metric:secret/);
  assert.doesNotMatch(JSON.stringify(history), /evidenceRefs/);
});

test('conversation history ignores malformed and incomplete historical runs', () => {
  const history = buildConversationHistory([
    { evidenceJson: '{bad json', findingsJson: '{}' },
    { evidenceJson: JSON.stringify({ request: { question: 42 } }), findingsJson: JSON.stringify({ summary: 'invalid question' }) },
    { evidenceJson: JSON.stringify({ request: { question: 'valid' } }), findingsJson: JSON.stringify({ summary: 'context', findings: [{ title: 9, action: null }] }) },
  ]);
  assert.deepEqual(history, [{ question: 'valid', summary: 'context', findings: [{ title: '', action: '' }] }]);
});
