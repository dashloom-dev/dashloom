import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const useSupabase = process.env.DASHLOOM_DATABASE === 'supabase';
const useNodeRuntime = !process.argv.some((argument) => argument.toLowerCase().includes('vinext'));
const supabaseAliases: Record<string, string> = useSupabase ? {
  '@/db': './db/postgres.ts',
  '@/db/schema': './db/schema.pg.ts',
  '@/db/runtime': './db/runtime.pg.ts',
  '@/db/dialect': './db/dialect.pg.ts',
} : {};

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { resolveAlias: { ...(useNodeRuntime ? { 'cloudflare:workers': './db/node-cloudflare-workers.ts' } : {}), ...supabaseAliases } },
  webpack(config) {
    if (useNodeRuntime) config.resolve.alias['cloudflare:workers'] = resolve(process.cwd(), 'db/node-cloudflare-workers.ts');
    if (useSupabase) {
      config.resolve.alias['@/db$'] = resolve(process.cwd(), 'db/postgres.ts');
      config.resolve.alias['@/db/schema$'] = resolve(process.cwd(), 'db/schema.pg.ts');
      config.resolve.alias['@/db/runtime$'] = resolve(process.cwd(), 'db/runtime.pg.ts');
      config.resolve.alias['@/db/dialect$'] = resolve(process.cwd(), 'db/dialect.pg.ts');
    }
    return config;
  },
};

export default nextConfig;
