import assert from 'node:assert/strict';
import test from 'node:test';
import { creemTimestamp, creemTransactionAmounts } from '../lib/creem-metrics.ts';

test('Creem transactions preserve gross paid revenue and refunds', () => {
  assert.deepEqual(creemTransactionAmounts({ status: 'paid', amount_paid: 2900, refunded_amount: 0 }), { revenueMinor: 2900, refundsMinor: 0, chargebacks: 0, paidTransactions: 1 });
  assert.deepEqual(creemTransactionAmounts({ status: 'partialRefund', amount_paid: 2900, refunded_amount: 400 }), { revenueMinor: 2900, refundsMinor: 400, chargebacks: 0, paidTransactions: 1 });
  assert.deepEqual(creemTransactionAmounts({ status: 'chargedBack', amount_paid: 2900 }), { revenueMinor: 0, refundsMinor: 0, chargebacks: 1, paidTransactions: 0 });
  assert.deepEqual(creemTransactionAmounts({ status: 'pending', amount_paid: 2900 }), { revenueMinor: 0, refundsMinor: 0, chargebacks: 0, paidTransactions: 0 });
});

test('Creem timestamps accept documented millisecond values and defensive second values', () => {
  assert.equal(creemTimestamp(1704067200000)?.toISOString(), '2024-01-01T00:00:00.000Z');
  assert.equal(creemTimestamp(1704067200)?.toISOString(), '2024-01-01T00:00:00.000Z');
  assert.equal(creemTimestamp(null), null);
});
