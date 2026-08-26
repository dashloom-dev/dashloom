export type OutcomeDirection = 'increase_good' | 'decrease_good' | 'contextual';
export type OutcomeAssessment = 'awaiting' | 'improved' | 'regressed' | 'unchanged' | 'changed' | 'insufficient';
export const ACTION_OUTCOME_LIMITATION = 'Observed metric movement after completion is a temporal association, not proof that the action caused the change.';

const lowerIsBetter = new Set([
  'position', 'errors', 'error_rate', 'refunds', 'chargebacks', 'churn_rate',
  'wall_time', 'cpu_time_p50', 'cpu_time_p99', 'queue_backlog_messages',
  'queue_backlog_bytes', 'queue_oldest_message_age_seconds', 'r2_errors',
  'r2_pending_uploads', 'vercel_failed_deployments', 'vercel_canceled_deployments',
  'vercel_deployment_duration_ms', 'vercel_days_since_deployment',
  'pages_failed_deployments', 'pages_canceled_deployments',
  'pages_deployment_duration_ms', 'pages_days_since_deployment',
]);

const higherIsBetter = new Set([
  'mrr', 'arr', 'revenue', 'paid_transactions', 'subscription_transactions',
  'paid_users', 'paid_customers', 'retention_rate', 'expansion_revenue',
  'signups', 'paid_signups', 'clicks', 'impressions', 'ctr', 'sessions',
  'organic_users', 'conversions', 'pages_successful_deployments',
  'pages_last_completed_deployment_success', 'vercel_successful_deployments',
  'vercel_last_completed_deployment_success', 'supabase_project_healthy',
]);

export function metricOutcomeDirection(metric: string): OutcomeDirection {
  if (lowerIsBetter.has(metric)) return 'decrease_good';
  if (higherIsBetter.has(metric)) return 'increase_good';
  return 'contextual';
}

export function metricChangePercent(baseline: number, latest: number) {
  if (!Number.isFinite(baseline) || !Number.isFinite(latest) || baseline === 0) return null;
  return ((latest - baseline) / Math.abs(baseline)) * 100;
}

export function assessActionOutcome(direction: OutcomeDirection, baseline: number, latest: number, tolerancePercent = 1): OutcomeAssessment {
  const change = metricChangePercent(baseline, latest);
  if (change === null) {
    if (latest === baseline) return 'unchanged';
    if (direction === 'contextual') return 'changed';
    const increased = latest > baseline;
    return (direction === 'increase_good' ? increased : !increased) ? 'improved' : 'regressed';
  }
  if (Math.abs(change) <= tolerancePercent) return 'unchanged';
  if (direction === 'contextual') return 'changed';
  const increased = latest > baseline;
  return (direction === 'increase_good' ? increased : !increased) ? 'improved' : 'regressed';
}
