import { createRemoteD1Database } from './remote-d1';

let database: D1Database | null = null;

function getRemoteDatabase() {
  if (!database) database = createRemoteD1Database({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID || '',
    apiToken: process.env.CLOUDFLARE_D1_API_TOKEN || '',
  });
  return database;
}

export const env = new Proxy({} as Record<string, unknown>, {
  get(_target, property) {
    if (property === 'DB') return getRemoteDatabase();
    return typeof property === 'string' ? process.env[property] : undefined;
  },
});

export function waitUntil(promise: Promise<unknown>) {
  void promise;
}
