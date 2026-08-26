import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestionPayloadSchema } from '../lib/ingestion-contract.ts';

const row = { productId: '11111111-1111-4111-8111-111111111111', source: 'customer_d1', metric: 'revenue', metricDate: '2026-08-26', value: 120, dimensions: { currency: 'USD' } };

test('ingestion contract accepts bounded normalized aggregate evidence', () => {
  assert.equal(ingestionPayloadSchema.parse({ rows: [row] }).rows[0].metric, 'revenue');
});

test('ingestion contract rejects invalid dates, unbounded dimensions, and extra fields', () => {
  assert.throws(() => ingestionPayloadSchema.parse({ rows: [{ ...row, metricDate: '2026-02-31' }] }));
  assert.throws(() => ingestionPayloadSchema.parse({ rows: [{ ...row, dimensions: Object.fromEntries(Array.from({ length: 13 }, (_, index) => [`key_${index}`, index])) }] }));
  assert.throws(() => ingestionPayloadSchema.parse({ rows: [{ ...row, dimensions: { email: 'person@example.com' } }] }));
  assert.throws(() => ingestionPayloadSchema.parse({ rows: [{ ...row, rawEmail: 'person@example.com' }] }));
});
