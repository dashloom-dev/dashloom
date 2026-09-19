import assert from 'node:assert/strict';
import test from 'node:test';
import { readableAgentStream } from '../lib/agent-stream.ts';
import { invokeOpenAiCompatibleWithFallback } from '../lib/openai-compatible.ts';

test('readable paragraphs arrive before JSON finishes and handle split escapes', () => {
  assert.equal(readableAgentStream('{"summary":"第一段'), '第一段');
  assert.equal(readableAgentStream('{"summary":"Hello\\nworld","findings":[{"title":"Next","detail":"Partial\\u4e'), 'Hello\nworld\n\nNext\n\nPartial');
  assert.equal(readableAgentStream('{"summary":"Say \\"hi\\"","productId":"secret","evidenceRefs":["private"]}'), 'Say "hi"');
});

test('streams UTF-8 deltas before provider closes and preserves final usage without default caps or deadlines', async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let firstDelta!: () => void;
  const arrived = new Promise<void>((resolve) => { firstDelta = resolve; });
  const deltas: string[] = [];
  const encoder = new TextEncoder();
  AbortSignal.timeout = () => assert.fail('No implicit deadline');
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.stream, true);
    assert.equal(body.max_tokens, undefined);
    return new Response(new ReadableStream({ start(value) { controller = value; } }), { headers: { 'content-type': 'text/event-stream' } });
  };
  try {
    const pending = invokeOpenAiCompatibleWithFallback({ baseUrl: 'https://example.com', apiKey: 'test', model: 'test', system: '', prompt: '', preferredProfile: 'standard_json', allowFallback: false, onTextDelta: (delta) => { deltas.push(delta); firstDelta(); } });
    const chunk = encoder.encode('data: {"choices":[{"delta":{"content":"第一段"}}]}\r\n\r\n');
    for (const byte of chunk) controller.enqueue(new Uint8Array([byte]));
    await arrived;
    assert.deepEqual(deltas, ['第一段']);
    controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"第二段"},"finish_reason":"stop"}]}\n\ndata: {"usage":{"prompt_tokens":30,"completion_tokens":4000}}\n\ndata: [DONE]\n\n'));
    controller.close();
    const result = await pending;
    assert.equal(result.text, '第一段第二段');
    assert.equal(result.usage.outputTokens, 4000);
    assert.equal(result.finishReason, 'stop');
  } finally { globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout; }
});

test('failure after a visible delta does not retry and duplicate the answer', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\ndata: {"error":{"code":500}}\n\n', { headers: { 'content-type': 'text/event-stream' } });
  };
  try {
    await assert.rejects(invokeOpenAiCompatibleWithFallback({ baseUrl: 'https://example.com', apiKey: 'test', model: 'test', system: '', prompt: '', preferredProfile: 'standard_stream', allowFallback: true, onTextDelta: () => {} }));
    assert.equal(requests, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('streaming excludes provider reasoning and manual cancellation closes the reader', async () => {
  const originalFetch = globalThis.fetch;
  const cancellation = new AbortController();
  const chunks: string[] = [];
  let cancelled = false;
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"reasoning_content":"private"}}]}\n\ndata: {"choices":[{"delta":{"content":"visible"}}]}\n\n'));
    },
    cancel() { cancelled = true; },
  }), { headers: { 'content-type': 'text/event-stream' } });
  try {
    await assert.rejects(invokeOpenAiCompatibleWithFallback({ baseUrl: 'https://example.com', apiKey: 'test', model: 'test', system: '', prompt: '', preferredProfile: 'standard_stream', allowFallback: true, abortSignal: cancellation.signal, onTextDelta: (text) => { chunks.push(text); cancellation.abort(); } }), { name: 'AbortError' });
    assert.deepEqual(chunks, ['visible']);
    assert.equal(cancelled, true);
  } finally { globalThis.fetch = originalFetch; }
});
