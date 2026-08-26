import assert from 'node:assert/strict';
import test from 'node:test';
import { buildActivationProgress, buildFirstValueGuide, type ActivationInput } from '../lib/activation-progress.ts';

const empty: ActivationInput = { productCount: 0, sourceReady: false, recentEvidenceCount: 0, modelReady: false, successfulAnalysisCount: 0, actedOnFindingCount: 0, reportScheduleCount: 0 };

test('activation starts with the first real product and marks later incomplete milestones as upcoming', () => {
  const progress = buildActivationProgress(empty);
  assert.equal(progress.completed, 0);
  assert.equal(progress.next?.id, 'product');
  assert.equal(progress.milestones[0].state, 'current');
  assert.ok(progress.milestones.slice(1).every((milestone) => milestone.state === 'upcoming'));
});

test('activation preserves out-of-order proof while pointing to the earliest missing milestone', () => {
  const progress = buildActivationProgress({ ...empty, productCount: 1, recentEvidenceCount: 4, modelReady: true, successfulAnalysisCount: 1 });
  assert.equal(progress.completed, 5);
  assert.equal(progress.next?.id, 'action');
  assert.equal(progress.milestones.find((milestone) => milestone.id === 'source')?.state, 'complete');
  assert.equal(progress.milestones.find((milestone) => milestone.id === 'report')?.state, 'upcoming');
});

test('activation is complete only after the recurring operating loop exists', () => {
  const progress = buildActivationProgress({ productCount: 1, sourceReady: true, recentEvidenceCount: 20, modelReady: true, successfulAnalysisCount: 2, actedOnFindingCount: 1, reportScheduleCount: 1 });
  assert.equal(progress.activated, true);
  assert.equal(progress.completed, progress.total);
  assert.equal(progress.next, null);
  assert.ok(progress.milestones.every((milestone) => milestone.state === 'complete'));
});

test('first value guide focuses onboarding on product, evidence, and first analysis', () => {
  const guide = buildFirstValueGuide(empty);
  assert.equal(guide.total, 3);
  assert.equal(guide.next?.id, 'product');
  assert.deepEqual(guide.steps.map((step) => step.id), ['product', 'data', 'analysis']);
});

test('connected source stays current until it writes real evidence', () => {
  const guide = buildFirstValueGuide({ ...empty, productCount: 1, sourceReady: true });
  assert.equal(guide.next?.id, 'data');
  assert.equal(guide.next?.action, 'Sync connected source');
  assert.equal(guide.completed, 1);
});

test('analysis step routes through model setup only when needed', () => {
  const withoutModel = buildFirstValueGuide({ ...empty, productCount: 1, sourceReady: true, recentEvidenceCount: 8 });
  assert.equal(withoutModel.next?.href, '/dashboard/agent#ai-provider');
  assert.equal(withoutModel.next?.action, 'Enable AI model');
  const ready = buildFirstValueGuide({ ...empty, productCount: 1, sourceReady: true, recentEvidenceCount: 8, modelReady: true });
  assert.equal(ready.next?.href, '/dashboard/agent');
  assert.equal(ready.next?.action, 'Run first analysis');
});

test('first value is complete only after a successful evidence-linked analysis', () => {
  const guide = buildFirstValueGuide({ ...empty, productCount: 1, sourceReady: true, recentEvidenceCount: 8, modelReady: true, successfulAnalysisCount: 1 });
  assert.equal(guide.complete, true);
  assert.equal(guide.completed, guide.total);
  assert.equal(guide.next, null);
});
