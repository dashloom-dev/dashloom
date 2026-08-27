import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.pg';
import { readSupabaseDatabaseConfig } from './supabase-config';

type BatchQuery = { toSQL(): { sql: string; params: unknown[] } };

let database: ReturnType<typeof createDatabase> | null = null;

function createDatabase() {
  const config = readSupabaseDatabaseConfig();
  const client = postgres(config.url, {
    max: config.poolSize,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    ssl: config.ssl,
  });
  const db = drizzle(client, { schema });
  return Object.assign(db, {
    async batch(queries: BatchQuery[]) {
      return client.begin(async (transaction) => {
        const results = [];
        for (const query of queries) {
          const built = query.toSQL();
          results.push(await transaction.unsafe(built.sql, built.params as never[]));
        }
        return results;
      });
    },
  });
}

export function getDb() {
  if (!database) database = createDatabase();
  return database;
}
