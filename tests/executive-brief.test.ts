import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentPreset } from '../lib/agent-catalog.ts';
import { buildExecutiveDigest, selectExecutivePresets, type ExecutiveFinding } from '../lib/executive-brief.ts';

const presets: AgentPreset[] = ['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst'];
const readiness = Object.fromEntries(presets.map((preset) => [preset, { ready: true }])) as Record<AgentPreset, { ready: boolean }>;

function finding(overrides: Partial<ExecutiveFinding> = {}): ExecutiveFinding {
  return {
    title: 'Revenue needs attention', detail: 'Revenue declined in the frozen window.', severity: 'warning', metric: 'revenue', productId: 'product-1', currentValue: 80, previousValue: 100, changePercent: -20, action: 'Inspect conversion and churn.', confidence: 0.8, evidenceRefs: ['metric:revenue'], ...overrides,
  };
}

test('executive selection requires at least two unique specialists', () => {
  const result = selectExecutivePresets({ requested: ['revenue_analyst', 'revenue_analyst'], readiness, capacity: 5 });
  assert.equal(result.code, 'AT_LEAST_TWO_SPECIALISTS');
  assert.deepEqual(result.selected, []);
});

test('executive selection rejects specialists without matching evidence', () => {
  const result = selectExecutivePresets({ requested: ['revenue_analyst', 'seo_growth_analyst'], readiness: { ...readiness, seo_growth_analyst: { ready: false } }, capacity: 5 });
  assert.equal(result.code, 'SPECIALIST_NOT_READY');
  assert.deepEqual(result.unavailable, ['seo_growth_analyst']);
});

test('executive selection respects provider capacity and canonical ordering', () => {
  const insufficient = selectExecutivePresets({ requested: ['seo_growth_analyst', 'revenue_analyst'], readiness, capacity: 1 });
  assert.equal(insufficient.code, 'INSUFFICIENT_AI_CAPACITY');
  const selected = selectExecutivePresets({ requested: ['operations_analyst', 'portfolio_analyst', 'revenue_analyst'], readiness, capacity: 3 });
  assert.equal(selected.code, null);
  assert.deepEqual(selected.selected, ['portfolio_analyst', 'revenue_analyst', 'operations_analyst']);
});

test('executive digest ranks severity and confidence, deduplicates, and preserves run provenance', () => {
  const digest = buildExecutiveDigest([
    { preset: 'revenue_analyst', runId: 'run-revenue', summary: 'Revenue summary', findings: [finding(), finding({ title: 'Critical churn', severity: 'critical', confidence: 0.7, evidenceRefs: ['metric:churn'] })] },
    { preset: 'portfolio_analyst', runId: 'run-portfolio', summary: 'Portfolio summary', findings: [finding({ confidence: 0.95 }), finding({ title: 'Expansion opportunity', severity: 'opportunity', confidence: 0.99 })] },
  ]);
  assert.equal(digest.counts.specialists, 2);
  assert.equal(digest.counts.findings, 4);
  assert.equal(digest.priorities.length, 3);
  assert.equal(digest.priorities[0].title, 'Critical churn');
  assert.equal(digest.priorities[1].analysisRunId, 'run-portfolio');
  assert.equal(digest.specialists[0].analysisRunId, 'run-revenue');
});
