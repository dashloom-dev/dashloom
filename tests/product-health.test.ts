import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProductHealth } from '../lib/product-health.ts';

test('product health penalizes stale, error-heavy, declining evidence deterministically', () => {
  const healthy = calculateProductHealth({ productId: 'one', freshness: '2026-08-26', now: new Date('2026-08-26T12:00:00Z'), metrics: [{ metric: 'requests', current: 1000, previous: 900, source: 'cloudflare' }, { metric: 'errors', current: 2, previous: 3, source: 'cloudflare' }, { metric: 'revenue', current: 120, previous: 100, source: 'stripe' }] });
  const risky = calculateProductHealth({ productId: 'two', freshness: '2026-08-10', now: new Date('2026-08-26T12:00:00Z'), metrics: [{ metric: 'requests', current: 100, previous: 100, source: 'cloudflare' }, { metric: 'errors', current: 10, previous: 2, source: 'cloudflare' }, { metric: 'revenue', current: 50, previous: 100, source: 'stripe' }] });
  assert.equal(healthy.status, 'healthy');
  assert.equal(healthy.score, 100);
  assert.equal(risky.status, 'risk');
  assert.ok(risky.score <= 20);
  assert.equal(risky.evidenceId, 'health:two');
});

test('product health converts provider operations evidence into explicit penalties', () => {
  const result = calculateProductHealth({ productId: 'ops', freshness: '2026-08-26', now: new Date('2026-08-26T12:00:00Z'), metrics: [
    { metric: 'r2_requests', current: 100, previous: 100, source: 'cloudflare_r2' },
    { metric: 'r2_errors', current: 8, previous: 1, source: 'cloudflare_r2' },
    { metric: 'pages_failed_deployments', current: 3, previous: 0, source: 'cloudflare_pages' },
    { metric: 'pages_last_completed_deployment_success', current: 0, previous: 1, source: 'cloudflare_pages' },
    { metric: 'supabase_project_healthy', current: 0, previous: 1, source: 'supabase' },
    { metric: 'queue_backlog_messages', current: 12000, previous: 20, source: 'cloudflare_queues' },
    { metric: 'queue_oldest_message_age_seconds', current: 4000, previous: 10, source: 'cloudflare_queues' },
  ] });
  assert.equal(result.status, 'risk'); assert.equal(result.score, 5); assert.ok(result.reasons.some((reason) => reason.includes('R2 error rate'))); assert.ok(result.reasons.some((reason) => reason.includes('Cloudflare Pages'))); assert.ok(result.reasons.some((reason) => reason.includes('Supabase'))); assert.ok(result.reasons.some((reason) => reason.includes('Queue pressure')));
});
