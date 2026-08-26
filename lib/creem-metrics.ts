export type CreemTransaction = {
  amount_paid?: number | null;
  refunded_amount?: number | null;
  currency?: string | null;
  status?: string | null;
  created_at?: number | string | null;
};

const paidStatuses = new Set(['paid', 'refunded', 'partialRefund', 'partial_refund', 'partially_refunded']);
const chargebackStatuses = new Set(['chargedBack', 'chargeback', 'charged_back']);

export function creemTimestamp(value: number | string | null | undefined) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!numeric || !Number.isFinite(numeric)) return null;
  const milliseconds = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function creemTransactionAmounts(transaction: CreemTransaction) {
  const status = transaction.status || '';
  return {
    revenueMinor: paidStatuses.has(status) ? Math.max(0, transaction.amount_paid || 0) : 0,
    refundsMinor: paidStatuses.has(status) ? Math.max(0, transaction.refunded_amount || 0) : 0,
    chargebacks: chargebackStatuses.has(status) ? 1 : 0,
    paidTransactions: paidStatuses.has(status) ? 1 : 0,
  };
}
