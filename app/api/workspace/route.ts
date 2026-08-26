import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { workspaces } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const updateInput = z.object({ name: z.string().trim().min(2).max(80), locale: z.enum(['en', 'zh']), timezone: z.string().trim().min(1).max(80) });
export async function PATCH(request: Request) { const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const workspace = await getPrimaryWorkspace(session.user.id); if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 }); if (!['owner', 'admin'].includes(workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 }); const parsed = updateInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid settings' }, { status: 400 }); try { new Intl.DateTimeFormat('en-US', { timeZone: parsed.data.timezone }).format(); } catch { return NextResponse.json({ error: 'Invalid IANA timezone.' }, { status: 400 }); } await getDb().update(workspaces).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(eq(workspaces.id, workspace.id)); await recordAuditEvent({ workspaceId: workspace.id, actorUserId: session.user.id, action: 'workspace.updated', targetType: 'workspace', targetId: workspace.id, metadata: parsed.data }); return NextResponse.json({ workspace: { ...workspace, ...parsed.data } }); }

const deleteInput = z.object({ confirmSlug: z.string() });
export async function DELETE(request: Request) { const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const workspace = await getPrimaryWorkspace(session.user.id); if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 }); if (workspace.role !== 'owner') return NextResponse.json({ error: 'Owner access required' }, { status: 403 }); const parsed = deleteInput.safeParse(await request.json().catch(() => null)); if (!parsed.success || parsed.data.confirmSlug !== workspace.slug) return NextResponse.json({ error: `Type ${workspace.slug} to confirm deletion.` }, { status: 400 }); await getDb().delete(workspaces).where(eq(workspaces.id, workspace.id)); return NextResponse.json({ deleted: true }); }
