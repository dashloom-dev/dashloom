import assert from 'node:assert/strict';
import test from 'node:test';
import { manualSyncTargets } from '../lib/manual-sync.ts';

test('manual sync deduplicates shared Google endpoints and resolves business connectors', () => {
  const targets = manualSyncTargets([
    { source: 'ga4', provider: 'google' }, { source: 'gsc', provider: 'google' },
    { source: 'business', provider: 'supabase' }, { source: 'supabase', provider: 'supabase' },
    { source: 'cloudflare_r2', provider: 'cloudflare' }, { source: 'custom', provider: 'custom' },
    { source: 'unknown', provider: 'unknown' },
  ], 'admin');
  assert.deepEqual(targets.map((target) => target.endpoint), ['/api/sync/google', '/api/sync/supabase', '/api/sync/cloudflare-r2', '/api/sync/custom-rest']);
});

test('manual sync respects member and read-only role permissions', () => {
  const mappings = [{ source: 'stripe', provider: 'stripe' }, { source: 'ga4', provider: 'google' }];
  assert.deepEqual(manualSyncTargets(mappings, 'member').map((target) => target.endpoint), ['/api/sync/google']);
  assert.deepEqual(manualSyncTargets(mappings, 'viewer'), []);
  assert.deepEqual(manualSyncTargets([], 'owner'), []);
});
