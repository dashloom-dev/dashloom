import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCalculatedFormula, calculatedMetricInput } from '../lib/calculated-formula.ts';

test('calculated metric definitions require exactly one right operand', () => {
  const base = { name: 'Revenue per user', metric: 'revenue_per_user', leftSource: 'stripe', leftMetric: 'revenue', operator: 'divide' as const };
  assert.equal(calculatedMetricInput.safeParse(base).success, false);
  assert.equal(calculatedMetricInput.safeParse({ ...base, rightSource: 'stripe', rightMetric: 'paid_users', constantValue: 100 }).success, false);
  assert.equal(calculatedMetricInput.safeParse({ ...base, rightSource: 'stripe', rightMetric: 'paid_users' }).success, true);
  assert.equal(calculatedMetricInput.safeParse({ ...base, constantValue: 100 }).success, true);
});

test('calculated metrics reject recursive calculated dependencies', () => {
  const parsed = calculatedMetricInput.safeParse({ name: 'Recursive', metric: 'recursive', leftSource: 'calculated', leftMetric: 'mrr', operator: 'add', constantValue: 1 });
  assert.equal(parsed.success, false);
});

test('calculated formulas protect division by zero and incompatible currencies', () => {
  assert.equal(applyCalculatedFormula({ value: 100, currency: 'usd' }, 0, 'divide'), null);
  assert.equal(applyCalculatedFormula({ value: 100, currency: 'usd' }, { value: 90, currency: 'eur' }, 'add'), null);
  assert.equal(applyCalculatedFormula({ value: 100, currency: 'usd' }, { value: 90, currency: 'eur' }, 'divide'), null);
  assert.equal(applyCalculatedFormula({ value: 100, currency: 'usd' }, { value: 2, currency: 'usd' }, 'multiply'), null);
});

test('calculated formulas preserve meaningful units', () => {
  assert.deepEqual(applyCalculatedFormula({ value: 100, currency: 'usd' }, { value: 4, currency: null }, 'divide'), { value: 25, currency: 'usd' });
  assert.deepEqual(applyCalculatedFormula({ value: 100, currency: 'usd' }, { value: 4, currency: 'usd' }, 'divide'), { value: 25, currency: null });
  assert.deepEqual(applyCalculatedFormula({ value: 100, currency: 'usd' }, 0.01, 'multiply', 100), { value: 100, currency: 'usd' });
});
