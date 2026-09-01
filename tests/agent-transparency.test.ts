import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Agent output contract requires a bounded evidence-linked readable reasoning summary', async () => {
  const source = await readFile(new URL('../lib/agent.ts', import.meta.url), 'utf8');
  assert.match(source, /reasoningSummary: z\.array\(reasoningSummaryStepSchema\)\.min\(1\)\.max\(4\)/);
  assert.match(source, /evidenceRefs: z\.array\([^\n]+\.min\(1\)\.max\(8\)/);
  assert.match(source, /readable, concise rationale rather than hidden chain-of-thought/);
});

test('Agent runtime records status transitions and persists the actual execution trace', async () => {
  const source = await readFile(new URL('../lib/agent.ts', import.meta.url), 'utf8');
  assert.match(source, /status: 'in_progress'/);
  assert.match(source, /status: 'completed'/);
  assert.match(source, /status: 'failed'/);
  assert.match(source, /executionTrace: \[\.\.\.executionTrace\]/);
});
