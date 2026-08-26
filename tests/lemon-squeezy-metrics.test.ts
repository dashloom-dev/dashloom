import assert from 'node:assert/strict';
import test from 'node:test';
import { lemonMonthlyRecurringAmount, lemonOrderAmounts } from '../lib/lemon-squeezy-metrics.ts';

test('Lemon Squeezy recurring prices normalize to monthly minor units', () => {
  assert.equal(lemonMonthlyRecurringAmount({ unitAmount: 12000, quantity: 1, interval: 'year', intervalCount: 1 }), 1000);
  assert.equal(lemonMonthlyRecurringAmount({ unitAmount: 3000, quantity: 2, interval: 'month', intervalCount: 3 }), 2000);
  assert.equal(lemonMonthlyRecurringAmount({ unitAmount: 500, quantity: 1, interval: 'week', intervalCount: 1 }), 500 * 52 / 12);
  assert.equal(lemonMonthlyRecurringAmount({ unitAmount: 500, quantity: 1, interval: 'month', intervalCount: 1, usageBased: true }), 0);
});

test('Lemon Squeezy orders include only commercial statuses and preserve refunds', () => {
  assert.deepEqual(lemonOrderAmounts({ status: 'paid', total: 1200, refundedAmount: 0 }), { revenueMinor: 1200, refundsMinor: 0 });
  assert.deepEqual(lemonOrderAmounts({ status: 'partial_refund', total: 1200, refundedAmount: 300 }), { revenueMinor: 1200, refundsMinor: 300 });
  assert.deepEqual(lemonOrderAmounts({ status: 'fraudulent', total: 1200, refundedAmount: 0 }), { revenueMinor: 0, refundsMinor: 0 });
});
