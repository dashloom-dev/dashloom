import assert from 'node:assert/strict';
import test from 'node:test';
import { anonymousDiagnosticsSchema } from '../lib/diagnostic-contract.ts';

const safeBundle = {
  schemaVersion: 1 as const, generatedAt: '2026-08-26T00:00:00.000Z', application: { name: 'Dashloom' as const, version: '0.1.0' },
  workspace: { plan: 'community', products: 2, members: 1 }, connectors: [{ provider: 'github', status: 'connected', count: 1 }],
  metrics: { points: 20, freshThrough: '2026-08-26', sources: [{ source: 'github', count: 20 }] },
  synchronization: [{ source: 'github', status: 'success', errorCode: null, recordsWritten: 20, startedAt: '2026-08-26T00:00:00Z', finishedAt: '2026-08-26T00:00:01Z' }],
  agent: [], reports: [], privacy: { excluded: ['identities', 'credentials', 'raw values'] },
};

test('anonymous diagnostic contract accepts bounded operational categories', () => {
  assert.equal(anonymousDiagnosticsSchema.safeParse(safeBundle).success, true);
});

test('anonymous diagnostic contract rejects accidental identity and raw error fields', () => {
  assert.equal(anonymousDiagnosticsSchema.safeParse({ ...safeBundle, workspaceId: 'secret' }).success, false);
  assert.equal(anonymousDiagnosticsSchema.safeParse({ ...safeBundle, synchronization: [{ ...safeBundle.synchronization[0], errorMessage: 'private URL' }] }).success, false);
  assert.equal(anonymousDiagnosticsSchema.safeParse({ ...safeBundle, connectors: [{ ...safeBundle.connectors[0], displayName: 'Private account' }] }).success, false);
});
