import assert from 'node:assert/strict';
import test from 'node:test';
import { hashToken, randomToken } from '../lib/tokens.ts';

test('share tokens are random and stored only as deterministic hashes', async () => {
  const first = randomToken(); const second = randomToken();
  assert.equal(first.length, 64); assert.notEqual(first, second);
  assert.equal((await hashToken(first)).length, 64);
  assert.equal(await hashToken(first), await hashToken(first));
  assert.notEqual(await hashToken(first), first);
});
