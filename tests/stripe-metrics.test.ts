import assert from 'node:assert/strict';
import test from 'node:test';
import { monthlyRecurringAmount, stripeMinorUnitDivisor, stripeTransactionMetric } from '../lib/stripe-metrics.ts';

test('Stripe recurring prices normalize into monthly minor units', () => {
  assert.equal(monthlyRecurringAmount({ unitAmount: 12000, quantity: 2, interval: 'year', intervalCount: 1 }), 2000);
  assert.equal(monthlyRecurringAmount({ unitAmount: 1000, quantity: 3, interval: 'month', intervalCount: 1 }), 3000);
  assert.equal(monthlyRecurringAmount({ unitAmount: 700, quantity: 1, interval: 'week', intervalCount: 1 }), 700 * 52 / 12);
});

test('Stripe currency conversion preserves zero-decimal currencies', () => {
  assert.equal(stripeMinorUnitDivisor('usd'), 100);
  assert.equal(stripeMinorUnitDivisor('JPY'), 1);
});

test('Stripe balance reporting categories map only commercial flows', () => {
  assert.equal(stripeTransactionMetric('charge'), 'revenue');
  assert.equal(stripeTransactionMetric('refund'), 'refunds');
  assert.equal(stripeTransactionMetric('payout'), null);
});
