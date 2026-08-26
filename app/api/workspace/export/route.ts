import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { competitorMetricPoints, competitors, metricPoints, productGoals, products } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';

export async function GET(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(session.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin'].includes(workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });

  const db = getDb();
  const [productRows, goalRows, metrics, competitorRows, competitorMetrics] = await Promise.all([
    db.select().from(products).where(eq(products.workspaceId, workspace.id)),
    db.select().from(productGoals).where(eq(productGoals.workspaceId, workspace.id)),
    db.select().from(metricPoints).where(eq(metricPoints.workspaceId, workspace.id)),
    db.select().from(competitors).where(eq(competitors.workspaceId, workspace.id)),
    db.select().from(competitorMetricPoints).where(eq(competitorMetricPoints.workspaceId, workspace.id)),
  ]);
  await recordAuditEvent({ workspaceId: workspace.id, actorUserId: session.user.id, action: 'workspace.exported', targetType: 'workspace', targetId: workspace.id, metadata: { format: 'portable-community-evidence-v6' } });
  const body = JSON.stringify({
    schemaVersion: 6,
    exportedAt: new Date().toISOString(),
    source: 'dashloom-community',
    products: productRows,
    productGoals: goalRows,
    metricPoints: metrics,
    competitors: competitorRows,
    competitorMetricPoints: competitorMetrics,
  });
  return new NextResponse(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="dashloom-community-${workspace.slug}-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' } });
}
