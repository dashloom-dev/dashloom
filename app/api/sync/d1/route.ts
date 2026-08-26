import { NextResponse } from 'next/server';
import { createAuth } from '@/lib/auth';
import { syncD1Workspace } from '@/lib/d1-connector';
import { refreshCalculatedMetricsSafely } from '@/lib/calculated-metrics';
import { getPrimaryWorkspace } from '@/lib/workspaces';

export async function POST(request: Request) {
  const authSession = await createAuth().api.getSession({ headers: request.headers });
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(authSession.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin', 'member'].includes(workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 });
  try { const outcome = await syncD1Workspace(workspace.id); return NextResponse.json({ ...outcome, calculated: await refreshCalculatedMetricsSafely(workspace.id) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'D1 sync failed' }, { status: 422 }); }
}
