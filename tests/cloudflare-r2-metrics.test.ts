import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeR2Day } from '../lib/cloudflare-r2-metrics.ts';

test('R2 daily normalization separates errors and storage stocks', () => {
  assert.deepEqual(normalizeR2Day([
    { dimensions: { actionStatus: 'success' }, sum: { requests: 90 } },
    { dimensions: { actionStatus: 'userError' }, sum: { requests: 7 } },
    { dimensions: { actionStatus: 'internalError' }, sum: { requests: 3 } },
  ], [{ max: { payloadSize: 1000, metadataSize: 80, objectCount: 12, uploadCount: 2 } }]), { requests: 100, errors: 10, payloadBytes: 1000, metadataBytes: 80, objects: 12, pendingUploads: 2 });
});

test('R2 normalization treats missing and negative provider values as zero', () => {
  assert.deepEqual(normalizeR2Day([{ sum: { requests: -2 } }, { sum: { requests: Number.NaN } }], [{ max: { payloadSize: Number.POSITIVE_INFINITY } }]), { requests: 0, errors: 0, payloadBytes: 0, metadataBytes: 0, objects: 0, pendingUploads: 0 });
});
