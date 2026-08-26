import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { agentExecutiveBriefs, products } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { createAuth } from '@/lib/auth';
import { runExecutiveBrief } from '@/lib/executive-brief-runner';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { resolveAgentProductScope } from '@/lib/agent-scope';

const preset = z.enum(['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst']);
const input = z.object({ question: z.string().trim().min(3).max(1000), presets: z.array(preset).min(2).max(5).refine((items) => new Set(items).size === items.length, 'Specialists must be unique.'), productId: z.string().uuid().nullable().optional() });

async function context(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return null;
  const workspace = await getPrimaryWorkspace(session.user.id);
  return workspace ? { session, workspace } : null;
}

export async function GET(request: Request) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const briefs = await getDb().select({ id: agentExecutiveBriefs.id, scopeMode: agentExecutiveBriefs.scopeMode, productId: agentExecutiveBriefs.productId, question: agentExecutiveBriefs.question, status: agentExecutiveBriefs.status, successCount: agentExecutiveBriefs.successCount, failureCount: agentExecutiveBriefs.failureCount, startedAt: agentExecutiveBriefs.startedAt, finishedAt: agentExecutiveBriefs.finishedAt, createdAt: agentExecutiveBriefs.createdAt }).from(agentExecutiveBriefs).where(eq(agentExecutiveBriefs.workspaceId, current.workspace.id)).orderBy(desc(agentExecutiveBriefs.createdAt)).limit(20);
  return NextResponse.json({ briefs });
}

export async function POST(request: Request) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(current.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid Executive Brief request' }, { status: 400 });
  const scope = resolveAgentProductScope(parsed.data.productId);
  if (scope.productId) { const [product] = await getDb().select({ id: products.id }).from(products).where(and(eq(products.id, scope.productId), eq(products.workspaceId, current.workspace.id))).limit(1); if (!product) return NextResponse.json({ error: 'Product not found in this workspace.' }, { status: 404 }); }
  try {
    const result = await runExecutiveBrief({ workspaceId: current.workspace.id, createdByUserId: current.session.user.id, question: parsed.data.question, presets: parsed.data.presets, scope });
    await recordAuditEvent({ workspaceId: current.workspace.id, actorUserId: current.session.user.id, action: 'agent_executive_brief.completed', targetType: 'agent_executive_brief', targetId: result.id, metadata: { status: result.status, scopeMode: scope.mode, productId: scope.productId, specialists: parsed.data.presets, successes: result.successes, failures: result.failures } });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Executive Brief failed' }, { status: 422 });
  }
}
