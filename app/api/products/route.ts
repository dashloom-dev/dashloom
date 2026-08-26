import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { products } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { getWorkspaceEntitlements } from '@/lib/entitlements';
import { buildProductSlug, normalizeProductDomain } from '@/lib/product-lifecycle';

const productInput = z.object({
  name: z.string().trim().min(2).max(80),
  domain: z.string().trim().max(255).optional().default(''),
  category: z.string().trim().max(80).optional().default(''),
});

async function context(request: Request) {
  const authSession = await createAuth().api.getSession({ headers: request.headers });
  if (!authSession) return null;
  const workspace = await getPrimaryWorkspace(authSession.user.id);
  if (!workspace) return null;
  return { authSession, workspace };
}

export async function GET(request: Request) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin', 'member'].includes(current.workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 });
  const rows = await getDb().select().from(products).where(eq(products.workspaceId, current.workspace.id)).orderBy(products.name);
  return NextResponse.json({ products: rows });
}

export async function POST(request: Request) {
  const current = await context(request);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(current.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });

  const parsed = productInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid product' }, { status: 400 });
  const [total] = await getDb().select({ value: count() }).from(products).where(eq(products.workspaceId, current.workspace.id)); const entitlements = await getWorkspaceEntitlements(current.workspace.id); if (Number(total?.value || 0) >= entitlements.products) return NextResponse.json({ error: `The ${entitlements.plan} plan allows ${entitlements.products} products.` }, { status: 403 });

  const normalizedDomain = normalizeProductDomain(parsed.data.domain);
  const baseSlug = buildProductSlug(parsed.data.name);
  const existing = await getDb().select({ id: products.id }).from(products).where(and(eq(products.workspaceId, current.workspace.id), eq(products.slug, baseSlug))).limit(1);
  const slug = existing.length ? `${baseSlug}-${crypto.randomUUID().slice(0, 6)}` : baseSlug;
  const row = {
    id: crypto.randomUUID(),
    workspaceId: current.workspace.id,
    name: parsed.data.name,
    slug,
    category: parsed.data.category || null,
    domain: normalizedDomain,
    status: 'active' as const,
  };
  await getDb().insert(products).values(row);
  await recordAuditEvent({ workspaceId: current.workspace.id, actorUserId: current.authSession.user.id, action: 'product.created', targetType: 'product', targetId: row.id, metadata: { name: row.name, domain: row.domain, category: row.category } });
  return NextResponse.json({ product: row }, { status: 201 });
}
