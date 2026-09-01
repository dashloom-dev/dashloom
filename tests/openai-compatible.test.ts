import assert from 'node:assert/strict';
import test from 'node:test';
import { detectOpenAiCompatibility, invokeOpenAiCompatible, invokeOpenAiCompatibleWithFallback, OpenAiCompatibleOutputError, parseCompatibleResponseBody, parseProviderCompatibility } from '../lib/openai-compatible.ts';

test('parses multi-line SSE events and common provider envelopes', () => {
  const body = 'event: message\n data: {"data":{"choices":[{"delta":\n data: {"content":"hello"},"finish_reason":"stop"}]}}\n\n data: [DONE]\n\n';
  const result = parseCompatibleResponseBody(body, 'text/event-stream; charset=utf-8');
  assert.equal(result.text, 'hello');
  assert.equal(result.finishReason, 'stop');
});

test('parses legacy completion and Responses API text shapes', () => {
  assert.equal(parseCompatibleResponseBody('{"choices":[{"text":"legacy"}]}').text, 'legacy');
  assert.equal(parseCompatibleResponseBody('{"response":{"output":[{"content":[{"type":"output_text","text":"modern"}]}]}}').text, 'modern');
});

test('empty output diagnostics expose structure without response values', () => {
  const secret = 'private-response-value';
  assert.throws(
    () => parseCompatibleResponseBody(JSON.stringify({ data: { choices: [{ message: { content: '' }, refusal: secret }] } })),
    (error: unknown) => {
      assert.ok(error instanceof OpenAiCompatibleOutputError);
      assert.equal(error.responseShape.bodyBytes > 0, true);
      assert.deepEqual(error.responseShape.rootKeys, ['data']);
      assert.equal(JSON.stringify(error.responseShape).includes(secret), false);
      return true;
    },
  );
});

test('standard compatibility includes the model and omits vendor-specific fields', async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    await invokeOpenAiCompatible({ baseUrl: 'https://example.com/v1', apiKey: 'test-key', model: 'test-model', system: 'system', prompt: 'prompt', profile: 'standard_json' });
    assert.equal(bodies[0]?.model, 'test-model');
    assert.equal(bodies[0]?.stream, false);
    assert.equal('max_tokens' in bodies[0], false);
    assert.equal('include_thoughts' in bodies[0], false);
  } finally { globalThis.fetch = originalFetch; }
});

test('automatic detection falls back from streaming to JSON and returns the validated profile', async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>; bodies.push(body);
    if (body.stream === true) return new Response(JSON.stringify({ error: { code: 'stream_not_supported' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await detectOpenAiCompatibility({ baseUrl: 'https://example.com/v1', apiKey: 'test-key', model: 'test-model', mode: 'auto' });
    assert.equal(result.profile, 'standard_json');
    assert.deepEqual(bodies.map((body) => body.stream), [true, false]);
  } finally { globalThis.fetch = originalFetch; }
});

test('automatic detection does not retry invalid credentials', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ error: { code: 'invalid_api_key' } }), { status: 401, headers: { 'content-type': 'application/json' } }); };
  try {
    await assert.rejects(detectOpenAiCompatibility({ baseUrl: 'https://example.com/v1', apiKey: 'test-key', model: 'test-model', mode: 'auto' }), (error: unknown) => Boolean(error && typeof error === 'object' && (error as { statusCode?: number }).statusCode === 401));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('managed invocation retries alternate request shapes after a safe compatibility rejection', async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>; bodies.push(body);
    if (body.stream === true) return new Response(JSON.stringify({ error: { code: 'stream_not_supported' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await invokeOpenAiCompatibleWithFallback({ baseUrl: 'https://api.kie.ai/gemini-3-7-flash-openai/v1', apiKey: 'test-key', model: 'gemini-3-7-flash', system: 'system', prompt: 'prompt', preferredProfile: 'model_endpoint_stream', allowFallback: true });
    assert.equal(result.text, 'OK');
    assert.equal(result.profile, 'model_endpoint_json');
    assert.deepEqual(bodies.map((body) => body.stream), [true, false]);
    assert.equal(bodies.every((body) => !('model' in body)), true);
  } finally { globalThis.fetch = originalFetch; }
});

test('managed invocation does not retry authentication, rate-limit, or server failures', async () => {
  const originalFetch = globalThis.fetch;
  for (const status of [401, 429, 503]) {
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ error: { code: `status_${status}` } }), { status, headers: { 'content-type': 'application/json' } }); };
    await assert.rejects(invokeOpenAiCompatibleWithFallback({ baseUrl: 'https://api.kie.ai/gemini-3-7-flash-openai/v1', apiKey: 'test-key', model: 'gemini-3-7-flash', system: 'system', prompt: 'prompt', preferredProfile: 'model_endpoint_stream', allowFallback: true }));
    assert.equal(calls, 1);
  }
  globalThis.fetch = originalFetch;
});

test('stored compatibility is reused and legacy Kie records infer a model endpoint profile', () => {
  assert.equal(parseProviderCompatibility('{"version":1,"profile":"standard_json","validatedAt":"now"}', 'https://example.com/v1').profile, 'standard_json');
  assert.equal(parseProviderCompatibility('{}', 'https://api.kie.ai/gemini-3-7-flash-openai/v1').profile, 'model_endpoint_stream');
  assert.equal(parseProviderCompatibility('{}', 'https://openrouter.ai/api/v1').profile, 'standard_stream');
});
