import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import {
  agentActionOutcomes,
  agentActions,
  agentConversations,
  agentExecutiveBriefs,
  agentGrowthMissions,
  auditEvents,
  competitorMetricPoints,
  competitors,
  dashboardViews,
  ingestionApiKeys,
  metricPoints,
  productConnectorMappings,
  productGoals,
  products,
  reports,
  reportSchedules,
} from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { createAuth } from '@/lib/auth';
import { normalizeProductDomain, productDeletionConfirmed, summarizeProductDeletionImpact, type ProductDeletionCounts } from '@/lib/product-lifecycle';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const updateInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('update'), name: z.string().trim().min(2).max(80), domain: z.string().trim().max(255).optional().default(''), category: z.string().trim().max(80).optional().default('') }),
  z.object({ action: z.literal('set_status'), status: z.enum(['active', 'paused', 'archived']) }),
]);
const deleteInput = z.object({ confirmName: z.string() });

async function context(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return null;
  const workspace = await getPrimaryWorkspace(session.user.id);
  return workspace ? { session, workspace } : null;
}

async function findProduct(workspaceId: string, id: string) {
  const [product] = await getDb().select().from(products).where(and(eq(products.id, id), eq(products.workspaceId, workspaceId))).limit(1);
  return product ?? null;
}

function value(row: { value: number } | undefined) { return Number(row?.value || 0); }

async function deletionCounts(workspaceId: string, productId: string): Promise<ProductDeletionCounts> {
  const db = getDb();
  const [connectorMappings, points, goals, competitorRows, competitorPoints, views, schedules, keys, conversations, briefs, actions, outcomes, missions, reportRows] = await Promise.all([
    db.select({ value: count() }).from(productConnectorMappings).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.productId, productId))),
    db.select({ value: count() }).from(metricPoints).where(and(eq(metricPoints.workspaceId, workspaceId), eq(metricPoints.productId, productId))),
    db.select({ value: count() }).from(productGoals).where(and(eq(productGoals.workspaceId, workspaceId), eq(productGoals.productId, productId))),
    db.select({ value: count() }).from(competitors).where(and(eq(competitors.workspaceId, workspaceId), eq(competitors.productId, productId))),
    db.select({ value: count() }).from(competitorMetricPoints).innerJoin(competitors, eq(competitorMetricPoints.competitorId, competitors.id)).where(and(eq(competitorMetricPoints.workspaceId, workspaceId), eq(competitors.productId, productId))),
    db.select({ value: count() }).from(dashboardViews).where(and(eq(dashboardViews.workspaceId, workspaceId), eq(dashboardViews.productId, productId))),
    db.select({ value: count() }).from(reportSchedules).where(and(eq(reportSchedules.workspaceId, workspaceId), eq(reportSchedules.productId, productId))),
    db.select({ value: count() }).from(ingestionApiKeys).where(and(eq(ingestionApiKeys.workspaceId, workspaceId), eq(ingestionApiKeys.productId, productId))),
    db.select({ value: count() }).from(agentConversations).where(and(eq(agentConversations.workspaceId, workspaceId), eq(agentConversations.productId, productId))),
    db.select({ value: count() }).from(agentExecutiveBriefs).where(and(eq(agentExecutiveBriefs.workspaceId, workspaceId), eq(agentExecutiveBriefs.productId, productId))),
    db.select({ value: count() }).from(agentActions).where(and(eq(agentActions.workspaceId, workspaceId), eq(agentActions.productId, productId))),
    db.select({ value: count() }).from(agentActionOutcomes).where(and(eq(agentActionOutcomes.workspaceId, workspaceId), eq(agentActionOutcomes.productId, productId))),
    db.select({ value: count() }).from(agentGrowthMissions).where(and(eq(agentGrowthMissions.workspaceId, workspaceId), eq(agentGrowthMissions.productId, productId))),
    db.select({ value: count() }).from(reports).where(and(eq(reports.workspaceId, workspaceId), eq(reports.productId, productId))),
  ]);
  return {
    connectorMappings: value(connectorMappings[0]), metricPoints: value(points[0]), goals: value(goals[0]), competitors: value(competitorRows[0]), competitorMetricPoints: value(competitorPoints[0]), dashboardViews: value(views[0]), reportSchedules: value(schedules[0]), ingestionKeys: value(keys[0]), conversations: value(conversations[0]), executiveBriefs: value(briefs[0]), agentActions: value(actions[0]), actionOutcomes: value(outcomes[0]), growthMissions: value(missions[0]), reports: value(reportRows[0]),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(current.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid product ID is required' }, { status: 400 });
  const product = await findProduct(current.workspace.id, id);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  const impact = summarizeProductDeletionImpact(await deletionCounts(current.workspace.id, id));
  return NextResponse.json({ product, impact });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(current.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid product ID is required' }, { status: 400 });
  const product = await findProduct(current.workspace.id, id);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid product update' }, { status: 400 });
  const updatedAt = new Date().toISOString();
  const changes = parsed.data.action === 'update'
    ? { name: parsed.data.name, domain: normalizeProductDomain(parsed.data.domain), category: parsed.data.category || null, updatedAt }
    : { status: parsed.data.status, updatedAt };
  const [updated] = await getDb().update(products).set(changes).where(and(eq(products.id, id), eq(products.workspaceId, current.workspace.id))).returning();
  await recordAuditEvent({ workspaceId: current.workspace.id, actorUserId: current.session.user.id, action: parsed.data.action === 'update' ? 'product.updated' : `product.${parsed.data.status}`, targetType: 'product', targetId: id, metadata: { before: product, changes } });
  return NextResponse.json({ product: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (current.workspace.role !== 'owner') return NextResponse.json({ error: 'Owner access required to permanently delete a product' }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid product ID is required' }, { status: 400 });
  const product = await findProduct(current.workspace.id, id);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  const parsed = deleteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !productDeletionConfirmed(product.name, parsed.data.confirmName)) return NextResponse.json({ error: `Type ${product.name} exactly to confirm deletion.` }, { status: 400 });
  const impact = summarizeProductDeletionImpact(await deletionCounts(current.workspace.id, id));
  const db = getDb();
  await db.batch([
    db.delete(products).where(and(eq(products.id, id), eq(products.workspaceId, current.workspace.id))),
    db.insert(auditEvents).values({ workspaceId: current.workspace.id, actorUserId: current.session.user.id, action: 'product.deleted', targetType: 'product', targetId: id, metadataJson: JSON.stringify({ product: { name: product.name, slug: product.slug }, impact }) }),
  ]);
  return NextResponse.json({ deleted: true, impact });
}
