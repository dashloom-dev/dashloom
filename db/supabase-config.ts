export type SupabaseDatabaseConfig = {
  url: string;
  poolSize: number;
  ssl: 'require' | false;
};

export function readSupabaseDatabaseConfig(environment: Record<string, string | undefined> = process.env): SupabaseDatabaseConfig {
  const raw = (environment.SUPABASE_DATABASE_URL || environment.DATABASE_URL || '').trim();
  if (!raw) throw new Error('SUPABASE_DATABASE_URL is required when DASHLOOM_DATABASE=supabase.');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('SUPABASE_DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password) {
    throw new Error('SUPABASE_DATABASE_URL must include a PostgreSQL host, user, and password.');
  }

  const requestedPoolSize = Number(environment.SUPABASE_DATABASE_POOL_SIZE || 5);
  if (!Number.isInteger(requestedPoolSize) || requestedPoolSize < 1 || requestedPoolSize > 20) {
    throw new Error('SUPABASE_DATABASE_POOL_SIZE must be an integer between 1 and 20.');
  }

  return {
    url: raw,
    poolSize: requestedPoolSize,
    ssl: environment.SUPABASE_DATABASE_SSL === 'disable' ? false : 'require',
  };
}
