import assert from 'node:assert/strict';
import test from 'node:test';
import { safePaddleApiUrl } from '../lib/paddle-api-policy.ts';

test('Paddle pagination accepts only the selected fixed API origin and expected resource', () => {
  assert.equal(safePaddleApiUrl('production', '/transactions?after=txn_one', '/transactions'), 'https://api.paddle.com/transactions?after=txn_one');
  assert.equal(safePaddleApiUrl('sandbox', 'https://sandbox-api.paddle.com/adjustments?after=adj_one', '/adjustments'), 'https://sandbox-api.paddle.com/adjustments?after=adj_one');
  assert.throws(() => safePaddleApiUrl('production', 'https://attacker.example/transactions', '/transactions'), /unexpected URL/);
  assert.throws(() => safePaddleApiUrl('production', 'https://api.paddle.com/customers', '/transactions'), /unexpected URL/);
  assert.throws(() => safePaddleApiUrl('sandbox', 'https://api.paddle.com/transactions', '/transactions'), /unexpected URL/);
});
