type SourceMetricRow = { metric_date: unknown; metric: unknown; value: unknown; dimensions_json: unknown };
type Dimension = string | number | boolean;
export type DashloomMetric = { productId: string; source: string; metric: string; metricDate: string; value: number; dimensions: Record<string, Dimension> };

class ConnectorError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export function dashloomIngestionUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new ConnectorError('INVALID_DASHLOOM_URL');
  if (url.pathname !== '/' && url.pathname !== '') throw new ConnectorError('INVALID_DASHLOOM_URL');
  url.pathname = '/api/ingest/v1/metrics';
  return url.toString();
}

export function normalizeSourceRows(rows: SourceMetricRow[], env: Pick<Env, 'DASHLOOM_PRODUCT_ID' | 'SOURCE_NAME'>): DashloomMetric[] {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(env.DASHLOOM_PRODUCT_ID)) throw new ConnectorError('INVALID_PRODUCT_ID');
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(env.SOURCE_NAME)) throw new ConnectorError('INVALID_SOURCE_NAME');
  if (rows.length > 1000) throw new ConnectorError('SOURCE_ROW_LIMIT_EXCEEDED');
  return rows.map((row) => {
    if (typeof row.metric_date !== 'string' || !realDate(row.metric_date)) throw new ConnectorError('INVALID_METRIC_DATE');
    if (typeof row.metric !== 'string' || !/^[a-z][a-z0-9_]{1,79}$/.test(row.metric)) throw new ConnectorError('INVALID_METRIC_NAME');
    if (typeof row.value !== 'number' || !Number.isFinite(row.value)) throw new ConnectorError('INVALID_METRIC_VALUE');
    const dimensions = parseDimensions(row.dimensions_json);
    return { productId: env.DASHLOOM_PRODUCT_ID, source: env.SOURCE_NAME, metric: row.metric, metricDate: row.metric_date, value: row.value, dimensions: { ...dimensions, connector: 'cloudflare_worker', evidence_mode: 'customer_account_binding' } };
  });
}

async function collectAndSend(env: Env, scheduledTime: number) {
  if (!env.DASHLOOM_API_KEY.startsWith('dlm_live_')) throw new ConnectorError('INVALID_INGESTION_SECRET');
  const lookback = Number(env.LOOKBACK_DAYS);
  if (!Number.isInteger(lookback) || lookback < 1 || lookback > 7) throw new ConnectorError('INVALID_LOOKBACK_DAYS');
  const end = new Date(scheduledTime).toISOString().slice(0, 10);
  const start = new Date(scheduledTime - (lookback - 1) * 86400000).toISOString().slice(0, 10);
  const result = await env.SOURCE_DB.prepare('SELECT metric_date, metric, value, dimensions_json FROM dashloom_metrics_daily WHERE metric_date BETWEEN ?1 AND ?2 ORDER BY metric_date, metric LIMIT 1001').bind(start, end).all<SourceMetricRow>();
  const rows = normalizeSourceRows(result.results, env);
  if (!rows.length) { console.log(JSON.stringify({ event: 'dashloom.sync.empty', start, end })); return; }
  const response = await fetch(dashloomIngestionUrl(env.DASHLOOM_URL), { method: 'POST', headers: { authorization: `Bearer ${env.DASHLOOM_API_KEY}`, 'content-type': 'application/json', 'user-agent': 'Dashloom-Connector-Worker/0.1' }, body: JSON.stringify({ rows }), redirect: 'error', signal: AbortSignal.timeout(15000) });
  await response.body?.cancel();
  if (!response.ok) throw new ConnectorError(`DASHLOOM_HTTP_${response.status}`);
  console.log(JSON.stringify({ event: 'dashloom.sync.complete', start, end, rows: rows.length, scheduledTime }));
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return Response.json({ status: 'ok', mode: 'scheduled_d1_aggregate' }, { headers: { 'cache-control': 'no-store' } });
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    try { await collectAndSend(env, controller.scheduledTime); }
    catch (error) { const code = error instanceof ConnectorError ? error.code : 'CONNECTOR_SYNC_FAILED'; console.error(JSON.stringify({ event: 'dashloom.sync.error', code, scheduledTime: controller.scheduledTime })); throw new ConnectorError(code); }
  },
} satisfies ExportedHandler<Env>;

function realDate(value: string) { const parsed = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value; }
function parseDimensions(value: unknown): Record<string, Dimension> {
  if (typeof value !== 'string' || value.length > 2000) throw new ConnectorError('INVALID_DIMENSIONS');
  let parsed: unknown; try { parsed = JSON.parse(value); } catch { throw new ConnectorError('INVALID_DIMENSIONS'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ConnectorError('INVALID_DIMENSIONS');
  const entries = Object.entries(parsed);
  if (entries.length > 10) throw new ConnectorError('INVALID_DIMENSIONS');
  const forbidden = new Set(['email', 'email_address', 'ip', 'ip_address', 'user_id', 'customer_id', 'session_id', 'token', 'secret', 'request_body']);
  for (const [key, item] of entries) if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || forbidden.has(key) || !(['string', 'number', 'boolean'].includes(typeof item)) || typeof item === 'string' && item.length > 120 || typeof item === 'number' && !Number.isFinite(item)) throw new ConnectorError('INVALID_DIMENSIONS');
  return Object.fromEntries(entries) as Record<string, Dimension>;
}
