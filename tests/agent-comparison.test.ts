import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceAgreement, evaluateComparisonResult } from '../lib/agent-comparison-evaluation.ts';

const evidence = { series: [{ evidenceId: 'metric:a' }, { evidenceId: 'metric:b' }], competitors: [], competitorTrends: [], crossSignals: [], healthScores: [] } as never;

test('comparison evaluation records deterministic compliance and evidence statistics', () => {
  const evaluation = evaluateComparisonResult({ summary: 'Summary', findings: [{ title: 'A', detail: 'Observed.', severity: 'warning', metric: 'a', productId: null, currentValue: 2, previousValue: 1, changePercent: 100, action: 'Inspect the source.', confidence: 0.8, evidenceRefs: ['metric:a'] }, { title: 'B', detail: 'Observed.', severity: 'opportunity', metric: 'b', productId: null, currentValue: 3, previousValue: 2, changePercent: 50, action: 'Run the experiment.', confidence: 0.6, evidenceRefs: ['metric:a', 'metric:b'] }] }, evidence);
  assert.deepEqual(evaluation.evidenceRefs, ['metric:a', 'metric:b']); assert.equal(evaluation.citationValidation, 'passed'); assert.equal(evaluation.findingCount, 2); assert.equal(evaluation.actionableFindings, 2); assert.equal(evaluation.averageConfidence, 0.7); assert.deepEqual(evaluation.severities, { info: 0, opportunity: 1, warning: 1, critical: 0 });
});

test('comparison agreement uses cited-evidence Jaccard similarity without semantic guessing', () => {
  assert.equal(evidenceAgreement(['a', 'b'], ['b', 'c']), 1 / 3); assert.equal(evidenceAgreement([], []), null);
});
