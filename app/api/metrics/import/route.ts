import { and, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { metricPoints, products } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { ingestionPayloadSchema } from '@/lib/ingestion-contract';

export async function POST(request: Request) {
  const authSession = await createAuth().api.getSession({ headers: request.headers });
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(authSession.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin', 'member'].includes(workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 });
  const parsed = ingestionPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid metrics' }, { status: 400 });
  const ids = [...new Set(parsed.data.rows.map((row) => row.productId))];
  const owned = await getDb().select({ id: products.id }).from(products).where(and(eq(products.workspaceId, workspace.id), inArray(products.id, ids)));
  if (owned.length !== ids.length) return NextResponse.json({ error: 'A product does not belong to this workspace' }, { status: 403 });
  let written = 0;
  // D1 local and production limits can be lower than upstream SQLite's
  // variable ceiling; ten 8-parameter rows stay safely below that limit.
  for (let index = 0; index < parsed.data.rows.length; index += 10) {
    const chunk = parsed.data.rows.slice(index, index + 10).map((row) => ({ workspaceId: workspace.id, productId: row.productId, source: row.source, metric: row.metric, metricDate: row.metricDate, value: row.value, dimensionsJson: JSON.stringify(row.dimensions), collectedAt: new Date().toISOString() }));
    await getDb().insert(metricPoints).values(chunk).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
    written += chunk.length;
  }
  return NextResponse.json({ written });
}
