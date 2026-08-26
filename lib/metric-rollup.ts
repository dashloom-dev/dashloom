export type MetricRollup = 'sum' | 'latest' | 'average';

const latestMetrics = new Set(['queue_backlog_messages', 'queue_backlog_bytes', 'queue_oldest_message_age_seconds', 'queue_delivery_paused', 'mrr', 'arr', 'paid_users', 'paid_customers', 'customers', 'subscribers', 'repo_stars', 'repo_forks', 'repo_open_issues_and_pulls', 'repo_watchers', 'repo_size_kb', 'repo_days_since_push', 'repo_archived', 'vercel_last_completed_deployment_success', 'vercel_days_since_deployment', 'pages_last_completed_deployment_success', 'pages_days_since_deployment', 'supabase_project_healthy', 'r2_payload_bytes', 'r2_metadata_bytes', 'r2_objects', 'r2_pending_uploads']);
const averageMetrics = new Set(['ctr', 'position', 'churn_rate', 'retention_rate', 'conversion_rate', 'error_rate', 'cpu_time_p50', 'cpu_time_p99', 'vercel_deployment_duration_ms', 'pages_deployment_duration_ms']);

export function metricRollup(metric: string): MetricRollup {
  if (latestMetrics.has(metric)) return 'latest';
  if (averageMetrics.has(metric) || metric.endsWith('_rate') || metric.endsWith('_percent')) return 'average';
  return 'sum';
}

export type RollupAccumulator = { sum: number; count: number; latestDate: string; latestValue: number };

export function addRollupValue(accumulator: RollupAccumulator, date: string, value: number) {
  accumulator.sum += value;
  accumulator.count += 1;
  if (!accumulator.latestDate || date >= accumulator.latestDate) {
    accumulator.latestDate = date;
    accumulator.latestValue = value;
  }
}

export function finishRollup(metric: string, accumulator: RollupAccumulator) {
  if (!accumulator.count) return 0;
  const strategy = metricRollup(metric);
  if (strategy === 'latest') return accumulator.latestValue;
  if (strategy === 'average') return accumulator.sum / accumulator.count;
  return accumulator.sum;
}
