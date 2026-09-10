import assert from 'node:assert/strict';
import test from 'node:test';
import { investigate, INVESTIGATION_LIMITS, breakdownMetricPredicate } from '../lib/agent-investigation.ts';
import { DatabaseSync } from 'node:sqlite';
import { and, eq, gte } from 'drizzle-orm';
import { sqliteTable, text, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { validateAgentCitations } from '../lib/agent-validation.ts';
import { invokeOpenAiCompatibleWithFallback, OpenAiCompatibleRequestError } from '../lib/openai-compatible.ts';

const request = { action: 'inspect_breakdown', productId: 'product-a', dimension: 'page' };

test('SQL breakdown reads cannot bypass workspace, product, date or label predicates', () => {
  const points = sqliteTable('points', { workspace: text('workspace'), product: text('product'), date: text('date'), label: text('label'), metric: text('metric') });
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE points (workspace TEXT, product TEXT, date TEXT, label TEXT, metric TEXT)');
    const insert = db.prepare('INSERT INTO points VALUES (?, ?, ?, ?, ?)');
    for (const metric of ['page_clicks', 'query_clicks']) {
      insert.run('allowed', 'product-a', '2026-09-10', 'target', metric);
      insert.run('other', 'product-a', '2026-09-10', 'target', metric);
      insert.run('allowed', 'product-b', '2026-09-10', 'target', metric);
      insert.run('allowed', 'product-a', '2020-01-01', 'target', metric);
      insert.run('allowed', 'product-a', '2026-09-10', 'other', metric);
    }
    const condition = and(eq(points.workspace, 'allowed'), eq(points.product, 'product-a'), gte(points.date, '2026-09-01'), breakdownMetricPredicate(points.metric), eq(points.label, 'target'))!;
    const query = new SQLiteSyncDialect().sqlToQuery(condition);
    const rows = db.prepare('SELECT * FROM points WHERE ' + query.sql).all(...query.params as string[]);
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.workspace === 'allowed' && row.product === 'product-a' && row.label === 'target'));
  } finally { db.close(); }
});

test('unsupported optional planner parameters fall back to the normal analysis', async () => {
  const trace = await investigate({ productIds: ['product-a'], context: () => '', decide: async () => { throw new OpenAiCompatibleRequestError(400); }, execute: async () => assert.fail('unsupported planner cannot read'), accept: () => {} });
  assert.equal(trace.stopReason, 'unsupported_provider');
  assert.equal(trace.steps.length, 0);
});

test('investigation deadline prevents new queries and preserves a bounded stop reason', async () => {
  const originalTimeout = AbortSignal.timeout;
  const timer = new AbortController();
  AbortSignal.timeout = () => timer.signal;
  try {
    const trace = await investigate({ productIds: ['product-a'], context: () => '', decide: async () => { timer.abort(); return JSON.stringify(request); }, execute: async () => assert.fail('expired investigation cannot read'), accept: () => {} });
    assert.equal(trace.stopReason, 'time_limit');
  } finally { AbortSignal.timeout = originalTimeout; }
});

test('investigation feeds new evidence into the next decision and citation validation', async () => {
  const evidence = { products: [{ id: 'product-a' }], series: [{ evidenceId: 'initial' }], competitors: [] };
  let calls = 0;
  const trace = await investigate({
    productIds: ['product-a'], context: () => JSON.stringify(evidence),
    decide: async (_system, prompt) => {
      if (calls++) { assert.match(prompt, /supplemental/); return '{"action":"finish"}'; }
      return JSON.stringify(request);
    },
    execute: async () => ({ records: [{ evidenceId: 'supplemental' }], truncated: false }),
    accept: (records) => evidence.series.push(...records),
  });
  assert.equal(trace.stopReason, 'finished');
  assert.deepEqual(trace.steps[0].evidenceRefs, ['supplemental']);
  validateAgentCitations({ findings: [{ title: 'Finding', productId: 'product-a', evidenceRefs: ['supplemental'] }] }, evidence);
});

test('untrusted decisions cannot escape product scope, add arguments, or execute arbitrary tools', async () => {
  for (const invalid of [ { ...request, productId: 'other-workspace' }, { ...request, sql: 'select *' }, { ...request, workspaceId: 'other' }, { ...request, action: 'shell' }, { ...request, dimension: 'secret' }, { ...request, label: 'x'.repeat(501) } ]) {
    const trace = await investigate({ productIds: ['product-a'], context: () => '', decide: async () => JSON.stringify(invalid), execute: async () => { assert.fail('must not execute'); }, accept: () => assert.fail('must not accept') });
    assert.equal(trace.stopReason, 'invalid_request');
  }
});

test('duplicate requests stop without repeated reads', async () => {
  let reads = 0;
  const trace = await investigate({ productIds: ['product-a'], context: () => '', decide: async () => JSON.stringify(request), execute: async () => { reads++; return { records: [], truncated: false }; }, accept: () => {} });
  assert.equal(reads, 1);
  assert.equal(trace.stopReason, 'duplicate_request');
});

test('step and record limits are enforced and incomplete coverage is recorded', async () => {
  let calls = 0;
  let accepted = 0;
  const trace = await investigate({ productIds: ['product-a'], context: () => 'x'.repeat(100_000), decide: async (_system, prompt) => {
    assert.ok(JSON.parse(prompt).context.length <= INVESTIGATION_LIMITS.promptCharacters);
    return JSON.stringify({ ...request, label: String(calls++) });
  }, execute: async () => ({ records: Array.from({ length: 100 }, (_, index) => ({ evidenceId: String(index) })), truncated: false }), accept: (records) => { accepted += records.length; } });
  assert.equal(calls, 2);
  assert.equal(accepted, 80);
  assert.equal(trace.stopReason, 'step_limit');
  assert.ok(trace.steps.every((step) => step.truncated));
});

test('cancellation after a model response prevents tool execution', async () => {
  const controller = new AbortController();
  await assert.rejects(investigate({ productIds: ['product-a'], signal: controller.signal, context: () => '', decide: async () => { controller.abort(); return JSON.stringify(request); }, execute: async () => assert.fail('cancelled run cannot read'), accept: () => {} }), { name: 'AbortError' });
});

test('provider failure propagates while already collected trace remains available', async () => {
  let calls = 0;
  let snapshot: { steps: unknown[] } | undefined;
  await assert.rejects(investigate({ productIds: ['product-a'], context: () => '', onTrace: (trace) => { snapshot = trace; }, decide: async () => { if (calls++) throw new Error('provider failed'); return JSON.stringify(request); }, execute: async () => ({ records: [], truncated: false }), accept: () => {} }), /provider failed/);
  assert.equal(snapshot?.steps.length, 1);
});

test('investigation output cap reaches compatible providers with fallback disabled', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    assert.equal(JSON.parse(String(init?.body)).max_tokens, INVESTIGATION_LIMITS.outputTokens);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"action":"finish"}' } }] }));
  };
  try {
    await invokeOpenAiCompatibleWithFallback({ baseUrl: 'https://example.com/v1', apiKey: 'test', model: 'test', system: 'test', prompt: 'test', preferredProfile: 'standard_json', allowFallback: false, maxOutputTokens: INVESTIGATION_LIMITS.outputTokens });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
