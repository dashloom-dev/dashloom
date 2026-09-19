import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureReadableReasoningSummary, ensureAgentEvidenceDisclosure, validateAgentCitations } from '../lib/agent-validation.ts';

const evidence = { products: [{ id: 'product' }], series: [{ evidenceId: 'metric:product:source:revenue' }], competitors: [{ evidenceId: 'competitor:acme:manual:traffic:2026-08-26' }], competitorTrends: [{ evidenceId: 'competitor-trend:acme:manual:traffic' }], crossSignals: [{ evidenceId: 'relationship:abc' }], healthScores: [{ evidenceId: 'health:product' }], goals: [{ evidenceId: 'goal:revenue-target' }], missions: [{ evidenceId: 'mission:growth-one' }], images: [{ evidenceId: `image:${'a'.repeat(64)}` }] };
test('derived reasoning preserves original citations and hypothesis disclosure', () => {
  const result = {
    summary: 'GSC clicks decreased.',
    findings: [
      { title: 'Clicks decreased', detail: 'Traffic moved lower.', evidenceRefs: ['metric:product:source:revenue'] },
      { title: 'Relationship', detail: '假设：两个指标同步变化，不代表因果关系。', evidenceRefs: ['relationship:abc'] },
    ],
  };
  const withSummary = ensureReadableReasoningSummary(result);
  assert.doesNotThrow(() => validateAgentCitations(withSummary, evidence));
  assert.deepEqual(withSummary.reasoningSummary[0].evidenceRefs, ['metric:product:source:revenue']);
  assert.match(withSummary.reasoningSummary[1].detail || '', /假设/);
  const invalid = ensureReadableReasoningSummary({ findings: [{ title: 'Invented', evidenceRefs: ['metric:missing'] }] });
  assert.throws(() => validateAgentCitations(invalid, evidence), /unknown evidence/);
});

test('agent validation accepts only citations present in the frozen evidence bundle', () => {
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Revenue moved', evidenceRefs: ['metric:product:source:revenue'] }] }, evidence));
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Health needs attention', evidenceRefs: ['health:product'] }] }, evidence));
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Hypothesis: signals moved together', evidenceRefs: ['relationship:abc'] }] }, evidence));
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Sessions caused revenue', detail: 'The relationship proves the cause.', evidenceRefs: ['relationship:abc'] }] }, evidence), /label relationship evidence as a hypothesis/);
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Competitor movement', evidenceRefs: ['competitor-trend:acme:manual:traffic'] }] }, evidence));
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Revenue goal is at risk', evidenceRefs: ['goal:revenue-target'] }] }, evidence));
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Growth mission is halfway to target', evidenceRefs: ['mission:growth-one'] }] }, evidence));
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'The screenshot shows an error state', evidenceRefs: [`image:${'a'.repeat(64)}`] }] }, evidence));
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Invented claim', evidenceRefs: ['metric:missing'] }] }, evidence), /unknown evidence/);
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Unsupported claim', evidenceRefs: [] }] }, evidence), /does not cite evidence/);
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Wrong product', productId: 'invented', evidenceRefs: ['metric:product:source:revenue'] }] }, evidence), /unknown product/);
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Revenue moved', evidenceRefs: ['metric:product:source:revenue'] }], reasoningSummary: [{ title: 'Compared revenue periods', detail: 'The current period is lower.', evidenceRefs: ['metric:product:source:revenue'] }] }, evidence));
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Revenue moved', evidenceRefs: ['metric:product:source:revenue'] }], reasoningSummary: [{ title: 'Unsupported rationale', detail: 'An unknown source changed.', evidenceRefs: ['metric:missing'] }] }, evidence), /Reasoning summary.*unknown evidence/);
});

test('agent validation requires disclosure when evidence collection is truncated', () => {
  const truncated = { ...evidence, truncated: { metrics: true, competitors: false } };
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Revenue moved', detail: 'Revenue declined.', evidenceRefs: ['metric:product:source:revenue'] }] }, truncated), /disclosed as incomplete/);
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Partial evidence', detail: 'Coverage is incomplete because the evidence limit was reached.', evidenceRefs: ['metric:product:source:revenue'] }] }, truncated));
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: '覆盖范围受限', detail: '本次仅覆盖部分关键词与页面数据。', evidenceRefs: ['metric:product:source:revenue'] }] }, truncated));
});

test('runtime deterministically adds a truncation disclosure without weakening citation checks', () => {
  const truncated = { ...evidence, truncated: { metrics: false, breakdowns: true, competitors: false } };
  const chinese = ensureAgentEvidenceDisclosure({ findings: [{ title: '关键词下降', detail: '曝光量下降。', evidenceRefs: ['metric:product:source:revenue'] }] }, truncated);
  assert.match(chinese.findings[0]!.detail || '', /部分数据/);
  assert.doesNotThrow(() => validateAgentCitations(chinese, truncated));
  assert.throws(() => validateAgentCitations(ensureAgentEvidenceDisclosure({ findings: [{ title: '关键词下降', detail: '曝光量下降。', evidenceRefs: ['metric:missing'] }] }, truncated), truncated), /unknown evidence/);
});
