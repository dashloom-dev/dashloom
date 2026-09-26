import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { drizzle } from 'drizzle-orm/d1';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);

function fixture(status = 'pending', options: { tokenFails?: boolean; discoveryFails?: boolean } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = OFF');
  for (const name of readdirSync(resolve(root, 'drizzle')).filter((name) => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(resolve(root, 'drizzle', name), 'utf8'));

  function prepare(query: string, args: SQLInputValue[] = []) {
    return {
      bind: (...values: SQLInputValue[]) => prepare(query, values),
      run: async () => ({ success: true, results: [], meta: sqlite.prepare(query).run(...args) }),
      all: async () => ({ success: true, results: sqlite.prepare(query).all(...args) }),
      raw: async () => { const statement = sqlite.prepare(query); statement.setReturnArrays(true); return statement.all(...args); },
    };
  }
  const client = { prepare, batch: async (statements: ReturnType<typeof prepare>[]) => {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.all());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  } };
  const db = drizzle(client as unknown as D1Database);
  const requests: string[] = [];
  const network = async (input: string, init?: RequestInit) => {
    requests.push(input);
    if (input.endsWith('/token')) return Response.json(options.tokenFails ? { error: 'invalid_grant' } : { access_token: 'test-access' }, { status: options.tokenFails ? 400 : 200 });
    if (input.includes('accountSummaries')) return Response.json({}, { status: options.discoveryFails ? 503 : 200 });
    if (input.endsWith('/sites')) return Response.json({ siteEntry: [{ siteUrl: 'sc-domain:example.test', permissionLevel: 'siteOwner' }] });
    if (input.endsWith('/searchAnalytics/query')) {
      const body = JSON.parse(String(init?.body));
      return Response.json({ rows: body.dimensions.length === 1 ? [{ keys: [new Date().toISOString().slice(0, 10)], clicks: 4, impressions: 20, ctr: 0.2, position: 3 }] : [] });
    }
    throw new Error(`Unexpected Google request: ${input}`);
  };
  const substitutes: Record<string, unknown> = {
    'cloudflare:workers': { env: { GOOGLE_OAUTH_CLIENT_ID: 'test', GOOGLE_OAUTH_CLIENT_SECRET: 'test' } },
    '@/db': { getDb: () => db },
    './crypto': { decryptSecret: async () => JSON.stringify({ refreshToken: 'test-refresh' }) },
  };
  const cache = new Map<string, Record<string, unknown>>();
  function load(path: string): Record<string, unknown> {
    const absolute = resolve(root, path);
    if (cache.has(absolute)) return cache.get(absolute)!;
    const output = transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
    const loaded = { exports: {} as Record<string, unknown> };
    cache.set(absolute, loaded.exports);
    const dependency = (name: string): unknown => {
      if (name in substitutes) return substitutes[name];
      const local = name.startsWith('@/') ? name.slice(2) : name.startsWith('.') ? resolve(dirname(absolute), name) : null;
      return local ? load(local.endsWith('.ts') ? local : `${local}.ts`) : require(name);
    };
    new Function('require', 'module', 'exports', 'fetch', output)(dependency, loaded, loaded.exports, network);
    return loaded.exports;
  }
  const google = load('lib/google.ts') as unknown as typeof import('../lib/google');
  sqlite.exec("INSERT INTO workspaces (id,slug,name,owner_user_id,plan) VALUES ('ws','ws','Test','user','studio'),('other','other','Other','other-user','studio')");
  sqlite.prepare("INSERT INTO connector_accounts (id,workspace_id,provider,display_name,status,encrypted_credentials) VALUES ('account','ws','google','Google',?,'encrypted')").run(status);
  sqlite.exec("INSERT INTO connector_resources (id,workspace_id,connector_account_id,type,resource_id,display_name,domains_json) VALUES ('resource','ws','account','gsc','sc-domain:example.test','Example','[\"example.test\"]')");
  sqlite.exec("INSERT INTO products (id,workspace_id,name,slug,domain,status) VALUES ('product','ws','Example','example','example.test','active')");
  const row = (query: string) => sqlite.prepare(query).get()!;
  return { sqlite, row, requests, sync: () => google.syncGoogleWorkspace('ws'), close: () => sqlite.close() };
}

for (const status of ['pending', 'attention', 'connected']) {
  test(`${status} Google account can recover and synchronize`, async () => {
    const f = fixture(status);
    try {
      const result = await f.sync();
      assert.equal(result.errors.length, 0);
      assert.ok(result.written > 0);
      assert.equal(f.row("SELECT status FROM connector_accounts WHERE id='account'").status, 'connected');
      assert.equal(f.requests.some((url) => url.includes('accountSummaries')), status !== 'connected');
      assert.equal(f.row('SELECT count(*) AS n FROM product_connector_mappings').n, 1);
    } finally { f.close(); }
  });
}

test('expired credentials keep data intact and mark the connector for attention', async () => {
  const f = fixture('pending', { tokenFails: true });
  try {
    const result = await f.sync();
    assert.match(result.errors[0], /token refresh.*400/);
    assert.equal(f.row("SELECT status FROM connector_accounts WHERE id='account'").status, 'attention');
    assert.equal(f.row('SELECT count(*) AS n FROM connector_resources').n, 1);
    assert.equal(f.row('SELECT status FROM sync_runs').status, 'error');
  } finally { f.close(); }
});

test('incomplete discovery preserves the saved resource snapshot', async () => {
  const f = fixture('pending', { discoveryFails: true });
  try {
    const result = await f.sync();
    assert.ok(result.errors.length);
    assert.equal(f.row('SELECT id FROM connector_resources').id, 'resource');
    assert.equal(f.row("SELECT status FROM connector_accounts WHERE id='account'").status, 'attention');
  } finally { f.close(); }
});

test('resource snapshot write failure rolls back deletion', async () => {
  const f = fixture('pending');
  try {
    f.sqlite.exec("CREATE TRIGGER fail_resource_insert BEFORE INSERT ON connector_resources BEGIN SELECT RAISE(ABORT, 'storage failure'); END");
    const result = await f.sync();
    assert.ok(result.errors.length);
    assert.equal(f.row('SELECT id FROM connector_resources').id, 'resource');
    assert.equal(f.row("SELECT status FROM connector_accounts WHERE id='account'").status, 'attention');
  } finally { f.close(); }
});
