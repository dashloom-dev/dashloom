import assert from 'node:assert/strict';
import test from 'node:test';
import { vercelDeploymentMetrics } from '../lib/vercel-metrics.ts';

test('Vercel deployments aggregate outcomes and duration without deployment content', () => {
  const result = vercelDeploymentMetrics([
    { created: Date.parse('2026-08-25T10:00:00Z'), ready: Date.parse('2026-08-25T10:02:00Z'), state: 'READY', target: 'production' },
    { created: Date.parse('2026-08-25T12:00:00Z'), ready: null, state: 'ERROR', target: 'preview' },
    { created: Date.parse('2026-08-24T12:00:00Z'), ready: null, readyState: 'CANCELED', target: 'preview' },
  ], new Date('2026-08-26T12:00:00Z'));
  assert.deepEqual(result.daily.get('2026-08-25'), { deployments: 2, successful: 1, failed: 1, canceled: 0, production: 1, durationTotal: 120000, durationCount: 1 });
  assert.equal(result.stocks.vercel_last_completed_deployment_success, 0);
  assert.equal(result.stocks.vercel_days_since_deployment, 1);
});

test('Vercel metrics ignore invalid creation timestamps', () => {
  const result = vercelDeploymentMetrics([{ created: Number.NaN, state: 'READY' }], new Date('2026-08-26T00:00:00Z'));
  assert.equal(result.daily.size, 0);
  assert.equal(result.stocks.vercel_last_completed_deployment_success, 0);
});
