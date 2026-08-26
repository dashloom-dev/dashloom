export type MetricPoint = { productId: string; source: string; metric: string; metricDate: string; value: number; dimensions?: Record<string, string | number | boolean> };
export type DashloomClientOptions = { baseUrl: string; apiKey: string; fetch?: typeof globalThis.fetch };

export class DashloomClient {
  private readonly baseUrl: string; private readonly apiKey: string; private readonly request: typeof globalThis.fetch;
  constructor(options: DashloomClientOptions) { this.baseUrl = options.baseUrl.replace(/\/$/, ''); this.apiKey = options.apiKey; this.request = options.fetch || globalThis.fetch; if (!this.baseUrl.startsWith('https://') && !this.baseUrl.startsWith('http://localhost')) throw new Error('Dashloom baseUrl must use HTTPS.'); if (!this.apiKey.startsWith('dlm_live_')) throw new Error('Invalid Dashloom ingestion key.'); }
  async pushMetrics(rows: MetricPoint[]) { if (!rows.length || rows.length > 1000) throw new Error('pushMetrics accepts 1 to 1000 rows.'); const response = await this.request(`${this.baseUrl}/api/ingest/v1/metrics`, { method: 'POST', headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ rows }) }); const result = await response.json() as { written?: number; workspaceId?: string; error?: string }; if (!response.ok) throw new Error(result.error || `Dashloom ingestion failed (${response.status}).`); return result as { written: number; workspaceId: string }; }
}
