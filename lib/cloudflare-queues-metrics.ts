export type QueueRealtimeMetrics = { backlog_count?: number | null; backlog_bytes?: number | null; oldest_message_timestamp_ms?: number | null };

function nonNegative(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0; }

export function normalizeQueueMetrics(metrics: QueueRealtimeMetrics, deliveryPaused: boolean, now = new Date()) {
  const oldest = nonNegative(metrics.oldest_message_timestamp_ms);
  return {
    queue_backlog_messages: nonNegative(metrics.backlog_count),
    queue_backlog_bytes: nonNegative(metrics.backlog_bytes),
    queue_oldest_message_age_seconds: oldest > 0 ? Math.max(0, Math.floor((now.getTime() - oldest) / 1000)) : 0,
    queue_delivery_paused: deliveryPaused ? 1 : 0,
  };
}
