import { NextResponse } from 'next/server';
import { createAuth } from '@/lib/auth';
import { refreshCalculatedMetricsSafely } from '@/lib/calculated-metrics';
import { syncCreemWorkspace } from '@/lib/creem-connector';
import { getPrimaryWorkspace } from '@/lib/workspaces';

export async function POST(request: Request) { const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const workspace = await getPrimaryWorkspace(session.user.id); if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 }); if (!['owner', 'admin'].includes(workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 }); try { const outcome = await syncCreemWorkspace(workspace.id); return NextResponse.json({ ...outcome, calculated: await refreshCalculatedMetricsSafely(workspace.id) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Creem synchronization failed' }, { status: 422 }); } }
