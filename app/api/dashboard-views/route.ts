import { and, desc, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { dashboardViews, products } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { dashboardConfigurationSchema, dashboardPresetSchema } from '@/lib/dashboard-templates';
import { recordAuditEvent } from '@/lib/audit';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const createInput = z.object({
  name: z.string().trim().min(2).max(80),
  preset: dashboardPresetSchema,
  productId: z.string().uuid().nullable().optional(),
  configuration: dashboardConfigurationSchema,
  isDefault: z.boolean().default(false),
});
const deleteInput = z.object({ id: z.string().uuid() });

async function context(request: Request) { const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return null; const workspace = await getPrimaryWorkspace(session.user.id); return workspace ? { session, workspace } : null; }

export async function GET(request: Request) {
  const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const views = await getDb().select().from(dashboardViews).where(eq(dashboardViews.workspaceId, value.workspace.id)).orderBy(desc(dashboardViews.updatedAt));
  return NextResponse.json({ views });
}

export async function POST(request: Request) {
  const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin', 'member'].includes(value.workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 });
  const parsed = createInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid view' }, { status: 400 });
  const db = getDb();
  if (parsed.data.productId) { const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, parsed.data.productId), eq(products.workspaceId, value.workspace.id))).limit(1); if (!product) return NextResponse.json({ error: 'Product not found in this workspace.' }, { status: 404 }); }
  const id = crypto.randomUUID();
  await db.insert(dashboardViews).values({ id, workspaceId: value.workspace.id, productId: parsed.data.productId || null, preset: parsed.data.preset, name: parsed.data.name, configurationJson: JSON.stringify(parsed.data.configuration), isDefault: parsed.data.isDefault });
  if (parsed.data.isDefault) await db.update(dashboardViews).set({ isDefault: false, updatedAt: new Date().toISOString() }).where(and(eq(dashboardViews.workspaceId, value.workspace.id), eq(dashboardViews.preset, parsed.data.preset), ne(dashboardViews.id, id)));
  await recordAuditEvent({ workspaceId: value.workspace.id, actorUserId: value.session.user.id, action: 'dashboard_view.created', targetType: 'dashboard_view', targetId: id, metadata: { preset: parsed.data.preset, productId: parsed.data.productId || null, isDefault: parsed.data.isDefault } });
  return NextResponse.json({ id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin', 'member'].includes(value.workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 });
  const parsed = deleteInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid view ID.' }, { status: 400 });
  const removed = await getDb().delete(dashboardViews).where(and(eq(dashboardViews.id, parsed.data.id), eq(dashboardViews.workspaceId, value.workspace.id))).returning({ id: dashboardViews.id });
  if (!removed.length) return NextResponse.json({ error: 'View not found.' }, { status: 404 });
  await recordAuditEvent({ workspaceId: value.workspace.id, actorUserId: value.session.user.id, action: 'dashboard_view.deleted', targetType: 'dashboard_view', targetId: parsed.data.id });
  return NextResponse.json({ deleted: true });
}
