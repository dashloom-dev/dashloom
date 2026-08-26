import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateSupabaseUsage, supabaseProjectHealthy } from '../lib/supabase-metrics.ts';

test('Supabase usage aggregates timestamped service counts into UTC days', () => {
  assert.deepEqual(aggregateSupabaseUsage([
    { timestamp: '2026-08-25T01:00:00Z', total_auth_requests: 3, total_realtime_requests: 4, total_rest_requests: 5, total_storage_requests: 6 },
    { timestamp: '2026-08-25T22:00:00Z', total_auth_requests: 2, total_rest_requests: 7 },
    { timestamp: 'invalid', total_auth_requests: 999 },
  ]), [{ metricDate: '2026-08-25', authRequests: 5, realtimeRequests: 4, restRequests: 12, storageRequests: 6, apiRequests: 27 }]);
});

test('Supabase normalization clamps invalid counts and recognizes only the healthy state', () => {
  assert.equal(aggregateSupabaseUsage([{ timestamp: '2026-08-25T00:00:00Z', total_auth_requests: -2, total_rest_requests: Number.NaN }])[0]?.apiRequests, 0);
  assert.equal(supabaseProjectHealthy('ACTIVE_HEALTHY'), 1);
  assert.equal(supabaseProjectHealthy('INACTIVE'), 0);
});
