export type LemonInterval = 'day' | 'week' | 'month' | 'year';

export function lemonMonthlyRecurringAmount(input: { unitAmount: number | null; quantity: number | null; interval: LemonInterval | null; intervalCount: number | null; usageBased?: boolean }) {
  if (input.usageBased || input.unitAmount === null || !input.interval) return 0;
  const amount = input.unitAmount * Math.max(1, input.quantity || 1); const count = Math.max(1, input.intervalCount || 1);
  if (input.interval === 'day') return amount * 30 / count;
  if (input.interval === 'week') return amount * 52 / 12 / count;
  if (input.interval === 'year') return amount / 12 / count;
  return amount / count;
}

export function lemonOrderAmounts(order: { status: string; total: number; refundedAmount: number }) {
  const commercial = ['paid', 'refunded', 'partial_refund'].includes(order.status);
  return { revenueMinor: commercial ? Math.max(0, order.total) : 0, refundsMinor: commercial ? Math.max(0, order.refundedAmount) : 0 };
}
