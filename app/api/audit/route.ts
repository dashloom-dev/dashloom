import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { auditEvents } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';

export async function GET(request: Request) { const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const workspace = await getPrimaryWorkspace(session.user.id); if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 }); if (!['owner', 'admin'].includes(workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 }); const events = await getDb().select().from(auditEvents).where(eq(auditEvents.workspaceId, workspace.id)).orderBy(desc(auditEvents.createdAt)).limit(200); return NextResponse.json({ events }); }
