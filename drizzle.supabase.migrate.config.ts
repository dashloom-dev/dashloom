import { defineConfig } from 'drizzle-kit';

const url = (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '').trim();
if (!url) throw new Error('SUPABASE_DATABASE_URL is required to migrate the Supabase storage backend.');

export default defineConfig({
  out: './drizzle-supabase',
  schema: './db/schema.pg.ts',
  dialect: 'postgresql',
  dbCredentials: { url },
});
