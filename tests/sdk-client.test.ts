import assert from 'node:assert/strict';
import test from 'node:test';
import { DashloomClient } from '../sdk/typescript/src/index.ts';

test('TypeScript client sends scoped metric batches with bearer authentication', async () => {
  let request: { url: string; init?: RequestInit } | null = null;
  const client = new DashloomClient({ baseUrl: 'https://dashloom.example/', apiKey: `dlm_live_${'a'.repeat(64)}`, fetch: async (input, init) => { request = { url: String(input), init }; return new Response(JSON.stringify({ written: 1, workspaceId: 'workspace' }), { status: 200 }); } });
  const result = await client.pushMetrics([{ productId: '00000000-0000-4000-8000-000000000001', source: 'billing', metric: 'mrr', metricDate: '2026-08-26', value: 99 }]);
  const sent = request as { url: string; init?: RequestInit } | null;
  assert.equal(result.written, 1); assert.equal(sent?.url, 'https://dashloom.example/api/ingest/v1/metrics'); assert.equal(new Headers(sent?.init?.headers).get('authorization'), `Bearer dlm_live_${'a'.repeat(64)}`);
});

test('TypeScript client rejects insecure remote base URLs and empty batches', async () => {
  assert.throws(() => new DashloomClient({ baseUrl: 'http://dashloom.example', apiKey: `dlm_live_${'a'.repeat(64)}` }), /HTTPS/);
  const client = new DashloomClient({ baseUrl: 'http://localhost:3000', apiKey: `dlm_live_${'a'.repeat(64)}` });
  await assert.rejects(client.pushMetrics([]), /1 to 1000/);
});
