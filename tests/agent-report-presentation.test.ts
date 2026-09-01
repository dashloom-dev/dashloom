import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('user-facing Agent reports hide internal evidence IDs while the audit page retains them', async () => {
  const [conversation, dashboard, comparison, radar, audit] = await Promise.all([
    readFile(new URL('../app/dashboard/agent/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/dashboard/views/[preset]/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/dashboard/agent/comparisons/[id]/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/dashboard/agent/radar/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/dashboard/agent/runs/[id]/page.tsx', import.meta.url), 'utf8'),
  ]);
  for (const report of [conversation, dashboard, comparison, radar]) {
    assert.doesNotMatch(report, /evidenceRefs\.map\(/);
    assert.doesNotMatch(report, /className="finding-evidence"/);
  }
  assert.match(audit, /evidenceRefs\.map\(/);
  assert.match(audit, /className="finding-evidence"/);
});
