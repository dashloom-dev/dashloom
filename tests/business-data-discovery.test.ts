import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { suggestBusinessMetrics, validateGuidedMappings } from '../lib/business-data-discovery.ts';
import { buildGuidedD1Configuration } from '../lib/d1-query.ts';

const resources = [
  { name: 'transactions', columns: [{ name: 'id', type: 'text' }, { name: 'amount_cents', type: 'integer' }, { name: 'paid_at', type: 'text' }] },
  { name: 'users', columns: [{ name: 'id', type: 'text' }, { name: 'created_at', type: 'text' }] },
  { name: 'subscriptions', columns: [{ name: 'id', type: 'text' }, { name: 'status', type: 'text' }, { name: 'updated_at', type: 'text' }] },
];

test('suggests common business fields without requiring SQL', () => {
  const suggestions = suggestBusinessMetrics(resources);
  assert.equal(suggestions.find((item) => item.metric === 'revenue')?.options[0]?.reason, 'transactions.amount_cents');
  assert.equal(suggestions.find((item) => item.metric === 'signups')?.options[0]?.reason, 'users.id');
  assert.equal(suggestions.find((item) => item.metric === 'active_subscriptions')?.options[0]?.filterColumn, 'status');
});

test('validates selections against the discovered schema and builds bounded read-only D1 SQL', () => {
  const mappings = suggestBusinessMetrics(resources).map((item) => item.options[0]).filter(Boolean);
  const validated = validateGuidedMappings(resources, mappings);
  const configuration = buildGuidedD1Configuration(validated, 'usd');
  assert.equal(configuration.metricDimensions?.revenue?.currency, 'USD');
  assert.match(configuration.sql, /^WITH /);
  assert.match(configuration.sql, /datetime\('now', '-90 days'\)/);
  assert.match(configuration.sql, /COUNT\(DISTINCT "id"\)/);
  assert.doesNotMatch(configuration.sql, /(?:INSERT|UPDATE|DELETE|DROP)\s/i);
});

test('rejects a field that was not present during discovery', () => {
  assert.throws(() => validateGuidedMappings(resources, [{
    metric: 'revenue', resource: 'transactions', valueColumn: 'secret_total', dateColumn: 'paid_at', confidence: 'high', reason: 'transactions.secret_total',
  }]));
});

test('restores server-discovered filters and scale instead of trusting client metadata', () => {
  const [mapping] = validateGuidedMappings(resources, [{
    metric: 'revenue', resource: 'transactions', valueColumn: 'amount_cents', dateColumn: 'paid_at', scale: 1, confidence: 'low', reason: 'tampered',
  }]);
  assert.equal(mapping.scale, 0.01);
  assert.equal(mapping.confidence, 'high');
  assert.equal(mapping.reason, 'transactions.amount_cents');
});

test('D1 discovery uses supported PRAGMA statements instead of the denied metadata join', async () => {
  const source = await readFile(new URL('../lib/d1-connector.ts', import.meta.url), 'utf8');
  assert.match(source, /runD1MetadataQuery\(credentials, 'PRAGMA table_list'\)/);
  assert.match(source, /`PRAGMA table_info\(\$\{quotedName\}\)`/);
  assert.doesNotMatch(source, /pragma_table_info\(m\.name\)/);
});

test('does not turn generic ids or payment statuses into unrelated business metrics', () => {
  const suggestions = suggestBusinessMetrics([
    { name: 'blog_categories', columns: [{ name: 'id', type: 'integer', primaryKey: true }, { name: 'created_at', type: 'text' }] },
    { name: 'payment_orders', columns: [{ name: 'merchant_order_id', type: 'text', primaryKey: true }, { name: 'amount_cents', type: 'integer' }, { name: 'status', type: 'text' }, { name: 'created_at', type: 'text' }] },
  ]);
  assert.equal(suggestions.find((item) => item.metric === 'orders')?.options[0]?.reason, 'payment_orders.merchant_order_id');
  assert.equal(suggestions.find((item) => item.metric === 'active_subscriptions')?.options.length, 0);
  assert.ok(!suggestions.find((item) => item.metric === 'orders')?.options.some((option) => option.resource === 'blog_categories'));
});

test('filters revenue and orders to successful payment states when a status field exists', () => {
  const suggestions = suggestBusinessMetrics([
    { name: 'payment_orders', columns: [{ name: 'id', type: 'text' }, { name: 'amount_cents', type: 'integer' }, { name: 'status', type: 'text' }, { name: 'created_at', type: 'text' }] },
  ]);
  const mappings = suggestions.flatMap((item) => item.options[0] ? [item.options[0]] : []);
  const configuration = buildGuidedD1Configuration(mappings);
  assert.match(configuration.sql, /lower\(CAST\("status" AS TEXT\)\) IN \('paid', 'completed', 'complete', 'succeeded', 'success', 'captured'\)/);
});

test('guided connector submissions omit hidden advanced mapping fields', async () => {
  const source = await readFile(new URL('../app/dashboard/sources/d1-form.tsx', import.meta.url), 'utf8');
  assert.match(source, /const payload = advanced/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{ \.\.\.Object\.fromEntries\(form\)/);
});
