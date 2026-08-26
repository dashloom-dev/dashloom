import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConnectorAccountViews, connectorProviderName } from '../lib/connector-lifecycle.ts';

test('connector lifecycle views expose account health without credentials or external IDs', () => {
  const account = { id: 'account-1', provider: 'stripe', displayName: 'Production revenue', status: 'connected' as const, lastCheckedAt: '2026-08-26T00:00:00.000Z', encryptedCredentials: 'must-not-leak', externalAccountId: 'acct_private' };
  const [view] = buildConnectorAccountViews([account], [{ connectorAccountId: account.id, enabled: true }, { connectorAccountId: account.id, enabled: false }]);
  assert.equal(view.id, account.id); assert.equal(view.providerName, 'Stripe'); assert.equal(view.mappingCount, 1); assert.equal(view.health, 'healthy');
  assert.equal('encryptedCredentials' in view, false);
  assert.equal('externalAccountId' in view, false);
});

test('connector lifecycle labels every built-in provider and safely formats unknown ones', () => {
  assert.equal(connectorProviderName('cloudflare_pages'), 'Cloudflare Pages');
  assert.equal(connectorProviderName('cloudflare_queues'), 'Cloudflare Queues');
  assert.equal(connectorProviderName('future_provider'), 'future provider');
});

test('connector lifecycle turns stable sync codes into actionable repair guidance', () => {
  const account = { id: 'account-1', provider: 'stripe', displayName: 'Production revenue', status: 'attention' as const, lastCheckedAt: '2026-08-26T00:00:00.000Z' };
  const [view] = buildConnectorAccountViews([account], [{ connectorAccountId: account.id, enabled: true }], [{ connectorAccountId: account.id, status: 'error', errorCode: 'STRIPE_SYNC_FAILED', createdAt: '2026-08-26T01:00:00.000Z' }]);
  assert.equal(view.health, 'needs_attention');
  assert.match(view.diagnosis, /STRIPE_SYNC_FAILED/);
  assert.match(view.repairChecks[0], /restricted read credential/);
  assert.equal('errorMessage' in view, false);
});

test('connected accounts without mappings explain the missing product scope', () => {
  const account = { id: 'account-1', provider: 'google', displayName: 'Acquisition', status: 'connected' as const, lastCheckedAt: null };
  const [view] = buildConnectorAccountViews([account], []);
  assert.equal(view.health, 'needs_attention');
  assert.match(view.diagnosis, /no active product mapping/);
  assert.match(view.repairChecks[1], /Create an active mapping/);
});
