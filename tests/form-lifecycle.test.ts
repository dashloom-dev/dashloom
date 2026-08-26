import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function tsxFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? tsxFiles(target) : entry.isFile() && entry.name.endsWith('.tsx') ? [target] : [];
  }));
  return nested.flat();
}

test('async forms never reset through the transient currentTarget reference', async () => {
  const files = await tsxFiles(path.join(process.cwd(), 'app'));
  const offenders: string[] = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (source.includes('event.currentTarget.reset()')) offenders.push(path.relative(process.cwd(), file));
  }
  assert.deepEqual(offenders, [], `Capture the form or use the submit event target before resetting: ${offenders.join(', ')}`);
});
