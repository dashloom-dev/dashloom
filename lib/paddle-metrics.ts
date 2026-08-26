export type PaddleTransaction = {
  id?: string; status?: string; currency_code?: string; billed_at?: string | null; created_at?: string | null; subscription_id?: string | null;
  details?: { totals?: { grand_total?: string | null } | null } | null;
};

export type PaddleAdjustment = {
  id?: string; action?: string; status?: string; currency_code?: string; created_at?: string | null;
  totals?: { total?: string | null } | null;
};

const zeroDecimalCurrencies = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);

function safeMinor(value: string | null | undefined) { if (!value || !/^-?\d+$/.test(value)) return 0; const parsed = Number(value); return Number.isSafeInteger(parsed) ? parsed : 0; }
export function paddleMinorToMajor(value: string | null | undefined, currency: string | null | undefined) { const normalized = currency?.toLowerCase(); return safeMinor(value) / (normalized && zeroDecimalCurrencies.has(normalized) ? 1 : 100); }
export function paddleDate(value: string | null | undefined) { if (!value) return null; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed; }
export function paddleMetricDimensions(currency: string, truncated: boolean) { return JSON.stringify({ currency: currency.toLowerCase(), ...(truncated ? { truncated: true, truncationReason: 'paddle_bounded_history_limit' } : {}) }); }

export function paddleTransactionAmounts(transaction: PaddleTransaction) {
  const paid = transaction.status === 'completed';
  return { revenue: paid ? Math.max(0, paddleMinorToMajor(transaction.details?.totals?.grand_total, transaction.currency_code)) : 0, paidTransactions: paid ? 1 : 0, subscriptionTransactions: paid && transaction.subscription_id ? 1 : 0 };
}

export function paddleAdjustmentAmounts(adjustment: PaddleAdjustment) {
  if (adjustment.status !== 'approved') return { refunds: 0, chargebacks: 0 };
  const amount = Math.max(0, paddleMinorToMajor(adjustment.totals?.total, adjustment.currency_code));
  if (adjustment.action === 'refund') return { refunds: amount, chargebacks: 0 };
  if (adjustment.action === 'chargeback') return { refunds: 0, chargebacks: amount };
  if (adjustment.action === 'chargeback_reverse') return { refunds: 0, chargebacks: -amount };
  return { refunds: 0, chargebacks: 0 };
}
