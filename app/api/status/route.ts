import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checkedAt = new Date().toISOString();
  try { await getDb().select({ value: sql<number>`1` }); return NextResponse.json({ status: 'operational', checks: { application: 'reachable', database: 'reachable' }, checkedAt }, { headers: { 'cache-control': 'no-store' } }); }
  catch { return NextResponse.json({ status: 'degraded', checks: { application: 'reachable', database: 'unreachable' }, checkedAt }, { status: 503, headers: { 'cache-control': 'no-store' } }); }
}
