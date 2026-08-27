import assert from 'node:assert/strict';
import test from 'node:test';
import { createRemoteD1Database } from '../db/remote-d1.ts';

test('remote D1 adapter sends parameterized statements to the fixed Cloudflare endpoint', async () => {
  const requests: Array<{ url: string; authorization: string | null; body: unknown }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ success: true, result: [{ success: true, results: [{ id: 'p1', total: 4 }], meta: { duration: 1 } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const database = createRemoteD1Database({ accountId: 'account', databaseId: 'database', apiToken: 'secret', fetcher });
  const result = await database.prepare('select id, total from products where id = ?').bind('p1').all<{ id: string; total: number }>();
  assert.deepEqual(result.results, [{ id: 'p1', total: 4 }]);
  assert.deepEqual(requests, [{
    url: 'https://api.cloudflare.com/client/v4/accounts/account/d1/database/database/query',
    authorization: 'Bearer secret',
    body: { sql: 'select id, total from products where id = ?', params: ['p1'] },
  }]);
});

test('remote D1 adapter fails closed on provider errors', async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ success: false, errors: [{ message: 'token rejected' }] }), { status: 403 });
  const database = createRemoteD1Database({ accountId: 'account', databaseId: 'database', apiToken: 'secret', fetcher });
  await assert.rejects(database.prepare('select 1').all(), /token rejected/);
});
