import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeQueueMetrics } from '../lib/cloudflare-queues-metrics.ts';

test('Queues normalization preserves operational stocks and message age', () => {
  assert.deepEqual(normalizeQueueMetrics({ backlog_count: 12, backlog_bytes: 4096, oldest_message_timestamp_ms: Date.parse('2026-08-26T00:00:00Z') }, true, new Date('2026-08-26T00:05:00Z')), { queue_backlog_messages: 12, queue_backlog_bytes: 4096, queue_oldest_message_age_seconds: 300, queue_delivery_paused: 1 });
});
test('Queues normalization fails closed for missing, negative, and future values', () => {
  assert.deepEqual(normalizeQueueMetrics({ backlog_count: -2, backlog_bytes: Number.NaN, oldest_message_timestamp_ms: Date.parse('2026-08-27T00:00:00Z') }, false, new Date('2026-08-26T00:00:00Z')), { queue_backlog_messages: 0, queue_backlog_bytes: 0, queue_oldest_message_age_seconds: 0, queue_delivery_paused: 0 });
});
