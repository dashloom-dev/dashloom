import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const nextCommand = process.argv[2];
if (!['dev', 'build', 'start'].includes(nextCommand)) {
  throw new Error('Usage: node scripts/run-supabase-next.mjs <dev|build|start>');
}

const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), nextCommand], {
  stdio: 'inherit',
  env: { ...process.env, DASHLOOM_DATABASE: 'supabase' },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
