import { NextResponse } from 'next/server';
import { createAuth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { buildAnonymousDiagnostics } from '@/lib/diagnostics';
import { getPrimaryWorkspace } from '@/lib/workspaces';

export async function GET(request: Request) { const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const workspace = await getPrimaryWorkspace(session.user.id); if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 }); const diagnostics = await buildAnonymousDiagnostics(workspace.id); await recordAuditEvent({ workspaceId: workspace.id, actorUserId: session.user.id, action: 'diagnostics.exported', targetType: 'workspace', targetId: workspace.id }); const body = JSON.stringify(diagnostics, null, 2); return new NextResponse(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="dashloom-diagnostics-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' } }); }
