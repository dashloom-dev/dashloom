import assert from 'node:assert/strict';
import test from 'node:test';
import { customRestHeaders, parseCustomMetricPayload, validateCustomRestConfiguration } from '../lib/custom-rest-contract.ts';
import { fetchCustomRestMetrics } from '../lib/custom-rest-client.ts';

test('Custom REST contract accepts bounded normalized metrics', () => {
  const result = parseCustomMetricPayload({ version: 1, truncated: true, metrics: [{ metric: 'trial_signups', date: '2026-08-25', value: 12, unit: 'users', domain: 'commercial', dimensions: { plan: 'studio', verified: true } }] }, new Date('2026-08-26T00:00:00Z'));
  assert.equal(result.truncated, true); assert.equal(result.metrics[0]?.metric, 'trial_signups'); assert.equal(result.metrics[0]?.domain, 'commercial'); assert.equal(result.metrics[0]?.dimensions.plan, 'studio');
});

test('Custom REST contract rejects malformed dates, identities, and oversized dimensions', () => {
  assert.throws(() => parseCustomMetricPayload({ version: 1, metrics: [{ metric: 'Bad Metric', date: '2026-02-30', value: 1 }] }), /contract v1/);
  assert.throws(() => parseCustomMetricPayload({ version: 1, metrics: [{ metric: 'valid_metric', date: '2026-08-27', value: 1 }] }, new Date('2026-08-26T00:00:00Z')), /future metric date/);
  assert.throws(() => parseCustomMetricPayload({ version: 1, metrics: [{ metric: 'valid_metric', date: '2026-08-25', value: 1, dimensions: Object.fromEntries(Array.from({ length: 13 }, (_, index) => [`key_${index}`, index])) }] }), /12 dimensions/);
  assert.throws(() => parseCustomMetricPayload({ version: 1, metrics: [{ metric: 'valid_metric', date: '2026-08-25', value: 1, dimensions: { user_id: 'person-1' } }] }), /contract v1/);
});

test('Custom REST configuration keeps secrets out of URLs and unsafe headers', () => {
  assert.equal(validateCustomRestConfiguration('https://metrics.example.com/dashloom', { authType: 'bearer', secret: 'secret' }), 'https://metrics.example.com/dashloom');
  assert.throws(() => validateCustomRestConfiguration('https://metrics.example.com/dashloom?token=secret', { authType: 'none' }), /query parameters/);
  assert.throws(() => validateCustomRestConfiguration('https://metrics.example.com/dashloom', { authType: 'api_key', secret: 'secret', headerName: 'Host' }), /custom X-/);
  assert.deepEqual(customRestHeaders({ authType: 'api_key', secret: 'secret', headerName: 'X-Dashloom-Key' })['X-Dashloom-Key'], 'secret');
});

test('Custom REST fetch enforces JSON contract and bounded response handling', async () => {
  const validateUrl = async (value: string) => new URL(value);
  const payload = await fetchCustomRestMetrics({ endpointUrl: 'https://metrics.example.com/dashloom', authType: 'bearer' }, 'secret', { validateUrl, fetcher: async (_input, init) => { assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer secret'); assert.equal(init?.redirect, 'error'); return new Response(JSON.stringify({ version: 1, metrics: [{ metric: 'paid_users', date: '2026-08-25', value: 10 }] }), { headers: { 'content-type': 'application/json' } }); } });
  assert.equal(payload.metrics.length, 1);
  await assert.rejects(fetchCustomRestMetrics({ endpointUrl: 'https://metrics.example.com/dashloom', authType: 'none' }, undefined, { validateUrl, fetcher: async () => new Response('not-json', { headers: { 'content-type': 'text/plain' } }) }), /application\/json/);
  await assert.rejects(fetchCustomRestMetrics({ endpointUrl: 'https://metrics.example.com/dashloom', authType: 'none' }, undefined, { validateUrl, fetcher: async () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(1024 * 1024 + 1) } }) }), /1 MiB/);
});
