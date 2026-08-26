import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { products, reports } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { generateWorkspaceReport } from '@/lib/reports';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { resolveAgentProductScope } from '@/lib/agent-scope';

const input = z.object({ preset: z.enum(['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst']), cadence: z.enum(['daily', 'weekly', 'monthly', 'manual']).default('manual'), productId: z.string().uuid().nullable().optional() });

async function context(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return null;
  const workspace = await getPrimaryWorkspace(session.user.id);
  return workspace ? { session, workspace } : null;
}

export async function GET(request: Request) {
  const value = await context(request);
  if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await getDb().select().from(reports).where(eq(reports.workspaceId, value.workspace.id)).orderBy(desc(reports.createdAt)).limit(50);
  return NextResponse.json({ reports: items });
}

export async function POST(request: Request) {
  const value = await context(request);
  if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin', 'member'].includes(value.workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid report request' }, { status: 400 });
  const scope = resolveAgentProductScope(parsed.data.productId);
  if (scope.productId) { const [product] = await getDb().select({ id: products.id }).from(products).where(and(eq(products.id, scope.productId), eq(products.workspaceId, value.workspace.id))).limit(1); if (!product) return NextResponse.json({ error: 'Product not found in this workspace.' }, { status: 404 }); }
  try { return NextResponse.json({ report: await generateWorkspaceReport(value.workspace.id, parsed.data.preset, parsed.data.cadence, undefined, scope) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Report generation failed' }, { status: 422 }); }
}
