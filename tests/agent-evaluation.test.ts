import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAgentOutput, type GoldenCase } from '../lib/agent-evaluation.ts';

const goldenCase: GoldenCase = {
  id: 'currency-boundary', preset: 'revenue_analyst', question: 'What changed?',
  evidence: { series: [{ evidenceId: 'mrr:usd', currency: 'usd' }, { evidenceId: 'mrr:eur', currency: 'eur' }], competitors: [], healthScores: [] },
  rubric: { requiredEvidenceGroups: [['mrr:usd'], ['mrr:eur']], requiredKeywordGroups: [['USD'], ['EUR']], forbiddenPhrases: ['combined total'], minimumFindings: 2, minimumConfidence: 0.5 },
};

test('golden evaluation accepts evidence-linked, currency-separated analysis', () => {
  const result = evaluateAgentOutput(goldenCase, { summary: 'USD improved while EUR declined.', findings: [
    { title: 'USD increased', detail: 'USD moved up.', action: 'Inspect upgrades.', confidence: 0.8, evidenceRefs: ['mrr:usd'] },
    { title: 'EUR declined', detail: 'EUR moved down.', action: 'Review churn.', confidence: 0.8, evidenceRefs: ['mrr:eur'] },
  ] });
  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
});

test('golden evaluation rejects cross-currency aggregation and invented citations', () => {
  const result = evaluateAgentOutput(goldenCase, { summary: 'Combined total MRR changed.', findings: [
    { title: 'All MRR', detail: 'Currencies combined.', action: '', confidence: 0.2, evidenceRefs: ['mrr:usd', 'mrr:eur'] },
    { title: 'Invented cause', detail: 'Pricing caused it.', action: 'Change price.', confidence: 0.9, evidenceRefs: ['missing'] },
  ] });
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((failure) => failure.includes('unknown evidence')));
  assert.ok(result.failures.some((failure) => failure.includes('across currencies')));
  assert.ok(result.failures.some((failure) => failure.includes('forbidden')));
});
