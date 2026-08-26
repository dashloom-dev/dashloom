export type PolarOrder = {
  created_at?: string | null;
  status?: string | null;
  paid?: boolean | null;
  net_amount?: number | null;
  refunded_amount?: number | null;
  currency?: string | null;
  billing_reason?: string | null;
};

export function polarOrderAmounts(order: PolarOrder) {
  const commercial = order.paid === true || ['paid', 'refunded', 'partially_refunded'].includes(order.status || '');
  return {
    revenueMinor: commercial ? Math.max(0, order.net_amount || 0) : 0,
    refundsMinor: commercial ? Math.max(0, order.refunded_amount || 0) : 0,
    paidTransactions: commercial ? 1 : 0,
  };
}

export function polarOrderDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
