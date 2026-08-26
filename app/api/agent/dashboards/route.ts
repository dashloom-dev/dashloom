import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAuth } from '@/lib/auth';
import { createDashboardFromAnalysis } from '@/lib/agent-dashboard';
import { recordAuditEvent } from '@/lib/audit';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const input = z.object({ analysisRunId: z.string().uuid() });

export async function POST(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(session.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin', 'member'].includes(workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'A valid analysis run is required.' }, { status: 400 });
  try {
    const { view, created } = await createDashboardFromAnalysis(workspace.id, parsed.data.analysisRunId);
    if (!view) throw new Error('Dashboard could not be created.');
    if (created) await recordAuditEvent({ workspaceId: workspace.id, actorUserId: session.user.id, action: 'dashboard_view.generated', targetType: 'dashboard_view', targetId: view.id, metadata: { analysisRunId: parsed.data.analysisRunId, preset: view.preset } });
    return NextResponse.json({ view: { id: view.id, preset: view.preset, url: `/dashboard/views/${view.preset}?view=${view.id}` }, replayed: !created }, { status: created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dashboard could not be created.' }, { status: 422 });
  }
}
