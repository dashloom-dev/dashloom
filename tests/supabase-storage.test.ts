import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getTableColumns, getTableName } from 'drizzle-orm';
import * as sqliteSchema from '../db/schema.ts';
import * as pgSchema from '../db/schema.pg.ts';
import { readSupabaseDatabaseConfig } from '../db/supabase-config.ts';

test('Supabase database configuration validates connection and pool settings', () => {
  const config = readSupabaseDatabaseConfig({
    SUPABASE_DATABASE_URL: 'postgresql://postgres.project:secret@pooler.supabase.test:6543/postgres',
    SUPABASE_DATABASE_POOL_SIZE: '4',
  });
  assert.equal(config.poolSize, 4);
  assert.equal(config.ssl, 'require');
  assert.throws(() => readSupabaseDatabaseConfig({}), /SUPABASE_DATABASE_URL is required/);
  assert.throws(() => readSupabaseDatabaseConfig({ SUPABASE_DATABASE_URL: 'https://example.com' }), /PostgreSQL host, user, and password/);
  assert.throws(() => readSupabaseDatabaseConfig({ SUPABASE_DATABASE_URL: config.url, SUPABASE_DATABASE_POOL_SIZE: '50' }), /between 1 and 20/);
});

test('Supabase schema preserves every D1 table and application column', async () => {
  const source = await readFile(new URL('../db/schema.ts', import.meta.url), 'utf8');
  const tableExports = [...source.matchAll(/export const (\w+) = sqliteTable\(/g)].map((match) => match[1]);
  assert.equal(tableExports.length, 38);

  for (const exportName of tableExports) {
    const sqliteTable = sqliteSchema[exportName as keyof typeof sqliteSchema];
    const pgTable = pgSchema[exportName as keyof typeof pgSchema];
    assert.ok(pgTable, `Missing PostgreSQL table export: ${exportName}`);
    assert.equal(getTableName(pgTable), getTableName(sqliteTable), `${exportName} table name differs`);
    const sqliteColumns = getTableColumns(sqliteTable);
    const pgColumns = getTableColumns(pgTable);
    assert.deepEqual(Object.keys(pgColumns), Object.keys(sqliteColumns), `${exportName} application columns differ`);
    assert.deepEqual(Object.values(pgColumns).map((column) => column.name), Object.values(sqliteColumns).map((column) => column.name), `${exportName} database columns differ`);
  }
});

test('Supabase migration creates the complete application schema', async () => {
  const migration = await readFile(new URL('../drizzle-supabase/0000_complete_korvac.sql', import.meta.url), 'utf8');
  assert.equal((migration.match(/CREATE TABLE/g) || []).length, 38);
  assert.match(migration, /CREATE TABLE "user"/);
  assert.match(migration, /CREATE TABLE "workspaces"/);
  assert.match(migration, /CREATE TABLE "metric_points"/);
  assert.match(migration, /CREATE TABLE "analysis_runs"/);
  assert.match(migration, /DEFAULT CURRENT_TIMESTAMP::text/);
});
