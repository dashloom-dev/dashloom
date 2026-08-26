import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudflarePagesDeploymentMetrics } from '../lib/cloudflare-pages-metrics.ts';

test('Cloudflare Pages deployments aggregate bounded status evidence without content', () => {
  const result = cloudflarePagesDeploymentMetrics([
    { created_on: '2026-08-25T10:00:00Z', environment: 'production', latest_stage: { status: 'success', ended_on: '2026-08-25T10:02:00Z' } },
    { created_on: '2026-08-25T12:00:00Z', environment: 'preview', latest_stage: { status: 'failure', ended_on: '2026-08-25T12:01:00Z' } },
    { created_on: '2026-08-24T12:00:00Z', environment: 'preview', is_skipped: true, latest_stage: { status: 'success', ended_on: '2026-08-24T12:00:01Z' } },
  ], new Date('2026-08-26T12:00:00Z'));
  assert.deepEqual(result.daily.get('2026-08-25'), { deployments: 2, successful: 1, failed: 1, canceled: 0, production: 1, skipped: 0, durationTotal: 180000, durationCount: 2 });
  assert.equal(result.daily.get('2026-08-24')?.skipped, 1);
  assert.equal(result.stocks.pages_last_completed_deployment_success, 0);
  assert.equal(result.stocks.pages_days_since_deployment, 1);
});

test('Cloudflare Pages metrics ignore invalid dates and do not treat skipped deployments as healthy', () => {
  const result = cloudflarePagesDeploymentMetrics([{ created_on: 'invalid', latest_stage: { status: 'success' } }, { created_on: '2026-08-25T00:00:00Z', is_skipped: true, latest_stage: { status: 'success' } }], new Date('2026-08-26T00:00:00Z'));
  assert.equal(result.daily.size, 1); assert.equal(result.stocks.pages_last_completed_deployment_success, null); assert.equal(result.stocks.pages_days_since_deployment, null);
});
