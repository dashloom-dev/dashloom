type D1Value = null | number | string | ArrayBuffer;
type RemoteQuery = { sql: string; params: D1Value[] };
type RemoteResult = { results: Record<string, unknown>[]; success: boolean; meta: Record<string, unknown>; error?: string };

type RemoteD1Options = {
  accountId: string;
  databaseId: string;
  apiToken: string;
  fetcher?: typeof fetch;
};

function required(value: string, name: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} is required when Dashloom runs outside Cloudflare Workers.`);
  return normalized;
}

export function createRemoteD1Database(options: RemoteD1Options): D1Database {
  const accountId = required(options.accountId, 'CLOUDFLARE_ACCOUNT_ID');
  const databaseId = required(options.databaseId, 'CLOUDFLARE_D1_DATABASE_ID');
  const apiToken = required(options.apiToken, 'CLOUDFLARE_D1_API_TOKEN');
  const request = options.fetcher || fetch;
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;

  async function query(input: RemoteQuery | RemoteQuery[]) {
    const response = await request(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(input),
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    const payload = await response.json().catch(() => null) as { success?: boolean; errors?: Array<{ message?: string }>; result?: RemoteResult[] } | null;
    if (!response.ok || !payload?.success || !Array.isArray(payload.result)) throw new Error(`Remote D1 query failed: ${payload?.errors?.[0]?.message || `HTTP ${response.status}`}`);
    for (const result of payload.result) if (!result.success) throw new Error(`Remote D1 statement failed: ${result.error || 'unknown D1 error'}`);
    return payload.result;
  }

  class PreparedStatement {
    readonly sql: string;
    readonly params: D1Value[];
    constructor(sql: string, params: D1Value[] = []) { this.sql = sql; this.params = params; }
    bind(...values: D1Value[]) { return new PreparedStatement(this.sql, values); }
    async first<T = Record<string, unknown>>(column?: string) { const result = (await this.all<T>()).results[0] as Record<string, unknown> | undefined; return column ? (result?.[column] as T | null) ?? null : (result as T | undefined) ?? null; }
    async run<T = Record<string, unknown>>() { return (await query({ sql: this.sql, params: this.params }))[0] as D1Result<T>; }
    async all<T = Record<string, unknown>>() { return (await query({ sql: this.sql, params: this.params }))[0] as D1Result<T>;
    }
    async raw<T = unknown[]>(options?: { columnNames?: boolean }) {
      const rows = (await query({ sql: this.sql, params: this.params }))[0].results;
      const names = rows[0] ? Object.keys(rows[0]) : [];
      const values = rows.map((row) => names.map((name) => row[name])) as T[];
      return (options?.columnNames ? [names, ...values] : values) as T[];
    }
  }

  return {
    prepare(sql: string) { return new PreparedStatement(sql) as unknown as D1PreparedStatement; },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      const inputs = statements.map((statement) => {
        const remote = statement as unknown as PreparedStatement;
        return { sql: remote.sql, params: remote.params };
      });
      return await query(inputs) as D1Result<T>[];
    },
    async exec(sql: string) { const result = (await query({ sql, params: [] }))[0]; return { count: 1, duration: Number(result.meta.duration || 0) }; },
    async dump() { throw new Error('Remote D1 dump is unavailable at application runtime. Use Wrangler for backups.'); },
    withSession() { throw new Error('D1 Sessions are not available through the remote HTTP adapter.'); },
  } as D1Database;
}
