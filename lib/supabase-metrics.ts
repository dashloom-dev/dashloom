export type SupabaseUsagePoint = {
  timestamp?: string | null;
  total_auth_requests?: number | null;
  total_realtime_requests?: number | null;
  total_rest_requests?: number | null;
  total_storage_requests?: number | null;
};

export type SupabaseDailyUsage = {
  metricDate: string;
  authRequests: number;
  realtimeRequests: number;
  restRequests: number;
  storageRequests: number;
  apiRequests: number;
};

function nonNegative(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function aggregateSupabaseUsage(points: SupabaseUsagePoint[]) {
  const daily = new Map<string, SupabaseDailyUsage>();
  for (const point of points) {
    if (!point.timestamp) continue;
    const timestamp = new Date(point.timestamp);
    if (Number.isNaN(timestamp.getTime())) continue;
    const metricDate = timestamp.toISOString().slice(0, 10);
    const value = daily.get(metricDate) || { metricDate, authRequests: 0, realtimeRequests: 0, restRequests: 0, storageRequests: 0, apiRequests: 0 };
    value.authRequests += nonNegative(point.total_auth_requests);
    value.realtimeRequests += nonNegative(point.total_realtime_requests);
    value.restRequests += nonNegative(point.total_rest_requests);
    value.storageRequests += nonNegative(point.total_storage_requests);
    value.apiRequests = value.authRequests + value.realtimeRequests + value.restRequests + value.storageRequests;
    daily.set(metricDate, value);
  }
  return [...daily.values()].sort((left, right) => left.metricDate.localeCompare(right.metricDate));
}

export function supabaseProjectHealthy(status: string | null | undefined) {
  return status === 'ACTIVE_HEALTHY' ? 1 : 0;
}
