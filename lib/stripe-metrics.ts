export type RecurringInterval = 'day' | 'week' | 'month' | 'year';

export function monthlyRecurringAmount(input: { unitAmount: number | null; quantity: number | null; interval: RecurringInterval; intervalCount: number }) {
  const amount = (input.unitAmount || 0) * (input.quantity || 1); const count = Math.max(1, input.intervalCount);
  if (input.interval === 'day') return amount * 30 / count;
  if (input.interval === 'week') return amount * 52 / 12 / count;
  if (input.interval === 'year') return amount / 12 / count;
  return amount / count;
}

export function stripeTransactionMetric(reportingCategory: string) {
  if (['charge', 'payment'].includes(reportingCategory)) return 'revenue' as const;
  if (['refund', 'payment_refund'].includes(reportingCategory)) return 'refunds' as const;
  return null;
}

const zeroDecimalCurrencies = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
export function stripeMinorUnitDivisor(currency: string) { return zeroDecimalCurrencies.has(currency.toLowerCase()) ? 1 : 100; }
