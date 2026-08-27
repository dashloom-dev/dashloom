import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle-supabase',
  schema: './db/schema.pg.ts',
  dialect: 'postgresql',
});
