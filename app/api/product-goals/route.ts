import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { productGoals, products } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const goalInput = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  metric: z.string().trim().regex(/^[a-z][a-z0-9_]{0,79}$/),
  source: z.string().trim().regex(/^[a-z][a-z0-9_:-]{0,79}$/).optional().default(''),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional().default(''),
  direction: z.enum(['at_least', 'at_most']),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  targetValue: z.number().finite().nonnegative(),
});
const updateInput = z.object({ id: z.string().uuid(), enabled: z.boolean() });
const removeInput = z.object({ id: z.string().uuid() });

async function context(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return null;
  const workspace = await getPrimaryWorkspace(session.user.id);
  return workspace ? { session, workspace } : null;
}

export async function GET(request: Request) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ goals: await getDb().select().from(productGoals).where(eq(productGoals.workspaceId, current.workspace.id)).orderBy(productGoals.name) });
}

export async function POST(request: Request) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(current.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = goalInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid product goal' }, { status: 400 });
  const [product] = await getDb().select({ id: products.id }).from(products).where(and(eq(products.id, parsed.data.productId), eq(products.workspaceId, current.workspace.id))).limit(1);
  if (!product) return NextResponse.json({ error: 'Product not found in this workspace.' }, { status: 404 });
  const [total] = await getDb().select({ value: count() }).from(productGoals).where(eq(productGoals.workspaceId, current.workspace.id));
  if (Number(total?.value || 0) >= 100) return NextResponse.json({ error: 'A workspace can contain up to 100 product goals.' }, { status: 403 });
  const id = crypto.randomUUID();
  await getDb().insert(productGoals).values({ id, workspaceId: current.workspace.id, productId: product.id, name: parsed.data.name, metric: parsed.data.metric, source: parsed.data.source || null, currency: parsed.data.currency ? parsed.data.currency.toLowerCase() : null, direction: parsed.data.direction, period: parsed.data.period, targetValue: parsed.data.targetValue, createdByUserId: current.session.user.id });
  await recordAuditEvent({ workspaceId: current.workspace.id, actorUserId: current.session.user.id, action: 'product_goal.created', targetType: 'product_goal', targetId: id, metadata: { productId: product.id, metric: parsed.data.metric, period: parsed.data.period, direction: parsed.data.direction } });
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(current.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid goal update.' }, { status: 400 });
  const [goal] = await getDb().select().from(productGoals).where(and(eq(productGoals.id, parsed.data.id), eq(productGoals.workspaceId, current.workspace.id))).limit(1);
  if (!goal) return NextResponse.json({ error: 'Product goal not found.' }, { status: 404 });
  await getDb().update(productGoals).set({ enabled: parsed.data.enabled, updatedAt: new Date().toISOString() }).where(and(eq(productGoals.id, goal.id), eq(productGoals.workspaceId, current.workspace.id)));
  await recordAuditEvent({ workspaceId: current.workspace.id, actorUserId: current.session.user.id, action: parsed.data.enabled ? 'product_goal.enabled' : 'product_goal.disabled', targetType: 'product_goal', targetId: goal.id, metadata: { productId: goal.productId, metric: goal.metric } });
  return NextResponse.json({ updated: true });
}

export async function DELETE(request: Request) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(current.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = removeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid goal ID.' }, { status: 400 });
  const [goal] = await getDb().select().from(productGoals).where(and(eq(productGoals.id, parsed.data.id), eq(productGoals.workspaceId, current.workspace.id))).limit(1);
  if (!goal) return NextResponse.json({ error: 'Product goal not found.' }, { status: 404 });
  await getDb().delete(productGoals).where(and(eq(productGoals.id, goal.id), eq(productGoals.workspaceId, current.workspace.id)));
  await recordAuditEvent({ workspaceId: current.workspace.id, actorUserId: current.session.user.id, action: 'product_goal.deleted', targetType: 'product_goal', targetId: goal.id, metadata: { productId: goal.productId, metric: goal.metric } });
  return NextResponse.json({ deleted: true });
}
