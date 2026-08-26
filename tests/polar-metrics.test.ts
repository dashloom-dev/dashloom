import assert from 'node:assert/strict';
import test from 'node:test';
import { polarOrderAmounts, polarOrderDate } from '../lib/polar-metrics.ts';

test('Polar paid and refunded orders preserve net revenue and refund evidence', () => {
  assert.deepEqual(polarOrderAmounts({ status: 'paid', paid: true, net_amount: 2900, refunded_amount: 0 }), { revenueMinor: 2900, refundsMinor: 0, paidTransactions: 1 });
  assert.deepEqual(polarOrderAmounts({ status: 'partially_refunded', paid: true, net_amount: 2900, refunded_amount: 400 }), { revenueMinor: 2900, refundsMinor: 400, paidTransactions: 1 });
  assert.deepEqual(polarOrderAmounts({ status: 'pending', paid: false, net_amount: 2900 }), { revenueMinor: 0, refundsMinor: 0, paidTransactions: 0 });
});

test('Polar dates reject invalid timestamps', () => {
  assert.equal(polarOrderDate('2026-08-25T10:00:00Z')?.toISOString(), '2026-08-25T10:00:00.000Z');
  assert.equal(polarOrderDate('invalid'), null);
});
