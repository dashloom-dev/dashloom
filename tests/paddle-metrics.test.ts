import assert from 'node:assert/strict';
import test from 'node:test';
import { paddleAdjustmentAmounts, paddleDate, paddleMetricDimensions, paddleMinorToMajor, paddleTransactionAmounts } from '../lib/paddle-metrics.ts';

test('Paddle completed transactions preserve currency precision and recurring evidence', () => {
  assert.deepEqual(paddleTransactionAmounts({ status: 'completed', currency_code: 'USD', billed_at: '2026-08-25T12:00:00Z', subscription_id: 'sub_one', details: { totals: { grand_total: '1299' } } }), { revenue: 12.99, paidTransactions: 1, subscriptionTransactions: 1 });
  assert.deepEqual(paddleTransactionAmounts({ status: 'completed', currency_code: 'JPY', details: { totals: { grand_total: '1299' } } }), { revenue: 1299, paidTransactions: 1, subscriptionTransactions: 0 });
  assert.deepEqual(paddleTransactionAmounts({ status: 'paid', currency_code: 'USD', details: { totals: { grand_total: '1299' } } }), { revenue: 0, paidTransactions: 0, subscriptionTransactions: 0 });
});

test('Paddle adjustments include only approved financial impact and reverse chargebacks explicitly', () => {
  assert.deepEqual(paddleAdjustmentAmounts({ status: 'approved', action: 'refund', currency_code: 'USD', totals: { total: '500' } }), { refunds: 5, chargebacks: 0 });
  assert.deepEqual(paddleAdjustmentAmounts({ status: 'approved', action: 'chargeback', currency_code: 'USD', totals: { total: '800' } }), { refunds: 0, chargebacks: 8 });
  assert.deepEqual(paddleAdjustmentAmounts({ status: 'approved', action: 'chargeback_reverse', currency_code: 'USD', totals: { total: '800' } }), { refunds: 0, chargebacks: -8 });
  assert.deepEqual(paddleAdjustmentAmounts({ status: 'pending_approval', action: 'refund', currency_code: 'USD', totals: { total: '500' } }), { refunds: 0, chargebacks: 0 });
});

test('Paddle amount and date parsing fail closed on malformed provider values', () => {
  assert.equal(paddleMinorToMajor('12.50', 'USD'), 0);
  assert.equal(paddleMinorToMajor('9007199254740993', 'USD'), 0);
  assert.equal(paddleDate('not-a-date'), null);
  assert.equal(paddleDate('2026-08-25T12:00:00Z')?.toISOString(), '2026-08-25T12:00:00.000Z');
});

test('Paddle partial scans become explicit Agent-visible metric evidence', () => {
  assert.deepEqual(JSON.parse(paddleMetricDimensions('USD', false)), { currency: 'usd' });
  assert.deepEqual(JSON.parse(paddleMetricDimensions('USD', true)), { currency: 'usd', truncated: true, truncationReason: 'paddle_bounded_history_limit' });
});
