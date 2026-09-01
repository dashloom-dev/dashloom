import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAgentCitations } from '../lib/agent-validation.ts';

const evidence = { products: [{ id: 'product' }], series: [{ evidenceId: 'metric:product:source:revenue' }], competitors: [{ evidenceId: 'competitor:acme:manual:traffic:2026-08-26' }], competitorTrends: [{ evidenceId: 'competitor-trend:acme:manual:traffic' }], crossSignals: [{ evidenceId: 'relationship:abc' }], healthScores: [{ evidenceId: 'health:product' }], goals: [{ evidenceId: 'goal:revenue-target' }], missions: [{ evidenceId: 'mission:growth-one' }] };
test('agent validation accepts only citations present in the frozen evidence bundle', () => {
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Revenue moved', evidenceRefs: ['metric:product:source:revenue'] }] }, evidence));
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Health needs attention', evidenceRefs: ['health:product'] }] }, evidence));
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Hypothesis: signals moved together', evidenceRefs: ['relationship:abc'] }] }, evidence));
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Sessions caused revenue', detail: 'The relationship proves the cause.', evidenceRefs: ['relationship:abc'] }] }, evidence), /label relationship evidence as a hypothesis/);
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Competitor movement', evidenceRefs: ['competitor-trend:acme:manual:traffic'] }] }, evidence));
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Revenue goal is at risk', evidenceRefs: ['goal:revenue-target'] }] }, evidence));
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Growth mission is halfway to target', evidenceRefs: ['mission:growth-one'] }] }, evidence));
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Invented claim', evidenceRefs: ['metric:missing'] }] }, evidence), /unknown evidence/);
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Unsupported claim', evidenceRefs: [] }] }, evidence), /does not cite evidence/);
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Wrong product', productId: 'invented', evidenceRefs: ['metric:product:source:revenue'] }] }, evidence), /unknown product/);
});

test('agent validation requires disclosure when evidence collection is truncated', () => {
  const truncated = { ...evidence, truncated: { metrics: true, competitors: false } };
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Revenue moved', detail: 'Revenue declined.', evidenceRefs: ['metric:product:source:revenue'] }] }, truncated), /disclosed as incomplete/);
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Partial evidence', detail: 'Coverage is incomplete because the evidence limit was reached.', evidenceRefs: ['metric:product:source:revenue'] }] }, truncated));
});

test('agent validation also requires disclosure when granular breakdowns are truncated', () => {
  const truncated = { ...evidence, truncated: { breakdowns: true } };
  assert.throws(() => validateAgentCitations({ findings: [{ title: 'Search changed', detail: 'Queries moved.', evidenceRefs: ['metric:product:source:revenue'] }] }, truncated), /disclosed as incomplete/);
  assert.doesNotThrow(() => validateAgentCitations({ findings: [{ title: 'Partial search evidence', detail: 'Query coverage is incomplete.', evidenceRefs: ['metric:product:source:revenue'] }] }, truncated));
});
