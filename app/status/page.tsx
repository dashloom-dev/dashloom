import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Deployment status — Dashloom Community', description: 'Current reachability of this self-hosted Dashloom deployment.', alternates: { canonical: '/status' } };

async function currentHealth() { const checkedAt = new Date().toISOString(); try { await getDb().select({ value: sql<number>`1` }); return { level: 'operational', database: 'reachable', checkedAt } as const; } catch { return { level: 'degraded', database: 'unreachable', checkedAt } as const; } }

export default async function StatusPage() {
  const health = await currentHealth();
  return <main className="content-page"><nav className="site-nav"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></Link><div className="nav-actions"><Link className="text-link" href="/docs">Docs</Link><Link className="button button-small" href="/login">Open Dashloom</Link></div></nav><article className="prose-shell"><div className="eyebrow"><span />Deployment status</div><h1>{health.level === 'operational' ? 'This deployment is reachable.' : 'This deployment is degraded.'}</h1><p className="lead">This is a live application and database reachability check for the current self-hosted installation. It is not an uptime history or a hosted-service status page.</p><h2>Current check</h2><p><strong>Application:</strong> reachable<br /><strong>Database:</strong> {health.database}<br /><strong>Checked:</strong> {new Date(health.checkedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</p></article></main>;
}
