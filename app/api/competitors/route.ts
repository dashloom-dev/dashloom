import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { competitors, products } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const input = z.object({ name: z.string().trim().min(2).max(100), domain: z.string().trim().max(255).optional().default(''), productId: z.string().uuid().nullable().optional() });
async function context(request: Request) { const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return null; const workspace = await getPrimaryWorkspace(session.user.id); return workspace ? { session, workspace } : null; }
export async function GET(request: Request) { const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json({ competitors: await getDb().select().from(competitors).where(eq(competitors.workspaceId, value.workspace.id)) }); }
export async function POST(request: Request) { const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); if (!['owner', 'admin', 'member'].includes(value.workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 }); const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid competitor' }, { status: 400 }); if (parsed.data.productId) { const [product] = await getDb().select({ id: products.id }).from(products).where(and(eq(products.id, parsed.data.productId), eq(products.workspaceId, value.workspace.id))).limit(1); if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 }); } const id = crypto.randomUUID(); const domain = parsed.data.domain ? parsed.data.domain.replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase() : null; await getDb().insert(competitors).values({ id, workspaceId: value.workspace.id, productId: parsed.data.productId || null, name: parsed.data.name, domain, status: 'active' }); await recordAuditEvent({ workspaceId: value.workspace.id, actorUserId: value.session.user.id, action: 'competitor.created', targetType: 'competitor', targetId: id, metadata: { name: parsed.data.name, domain } }); return NextResponse.json({ competitor: { id, name: parsed.data.name, domain, productId: parsed.data.productId || null } }, { status: 201 }); }
