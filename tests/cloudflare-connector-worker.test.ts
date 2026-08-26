import assert from 'node:assert/strict';
import test from 'node:test';
import { dashloomIngestionUrl, normalizeSourceRows } from '../examples/cloudflare-connector-worker/src/index.ts';

const env = { DASHLOOM_PRODUCT_ID: '11111111-1111-4111-8111-111111111111', SOURCE_NAME: 'customer_d1' } as const;

test('customer-side Connector Worker targets only the fixed HTTPS ingestion path', () => {
  assert.equal(dashloomIngestionUrl('https://dashloom.example'), 'https://dashloom.example/api/ingest/v1/metrics');
  assert.throws(() => dashloomIngestionUrl('http://dashloom.example'), /INVALID_DASHLOOM_URL/);
  assert.throws(() => dashloomIngestionUrl('https://dashloom.example/collect?token=secret'), /INVALID_DASHLOOM_URL/);
});

test('customer-side Connector Worker emits aggregate evidence with explicit provenance', () => {
  const rows = normalizeSourceRows([{ metric_date: '2026-08-26', metric: 'active_users', value: 12, dimensions_json: '{"environment":"production"}' }], env);
  assert.deepEqual(rows[0]?.dimensions, { environment: 'production', connector: 'cloudflare_worker', evidence_mode: 'customer_account_binding' });
  assert.equal(rows[0]?.productId, env.DASHLOOM_PRODUCT_ID);
});

test('customer-side Connector Worker fails closed on personal identifiers and oversized batches', () => {
  assert.throws(() => normalizeSourceRows([{ metric_date: '2026-08-26', metric: 'active_users', value: 12, dimensions_json: '{"user_id":"person-1"}' }], env), /INVALID_DIMENSIONS/);
  const oversized = Array.from({ length: 1001 }, () => ({ metric_date: '2026-08-26', metric: 'active_users', value: 12, dimensions_json: '{}' }));
  assert.throws(() => normalizeSourceRows(oversized, env), /SOURCE_ROW_LIMIT_EXCEEDED/);
});
