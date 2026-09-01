import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Agent composer supports upload and clipboard images through multipart requests', async () => {
  const source = await readFile(new URL('../app/dashboard/agent/agent-form.tsx', import.meta.url), 'utf8');
  assert.match(source, /type="file"/);
  assert.match(source, /onPaste=\{onPaste\}/);
  assert.match(source, /requestBody\.append\('images'/);
  assert.doesNotMatch(source, /'content-type': 'application\/json'/);
});

test('Agent route validates multipart images and binds them to the run', async () => {
  const source = await readFile(new URL('../app/api/agent/analyze/route.ts', import.meta.url), 'utf8');
  assert.match(source, /request\.formData\(\)/);
  assert.match(source, /validateAgentImageFiles\(form\.getAll\('images'\)\)/);
  assert.match(source, /images, onProgress/);
});
