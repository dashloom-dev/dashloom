import { and, count, countDistinct, eq, gte, isNull, max, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { ingestionApiKeys, metricPoints, products } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { summarizeAgentReadiness } from '@/lib/agent-catalog';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const querySchema = z.object({
  productId: z.string().uuid(),
  source: z.string().trim().regex(/^[a-z][a-z0-9_-]{1,39}$/).optional(),
});

export async function GET(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(session.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin', 'member', 'viewer'].includes(workspace.role)) return NextResponse.json({ error: 'Workspace access required' }, { status: 403 });
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ productId: url.searchParams.get('productId'), source: url.searchParams.get('source') || undefined });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid ingestion status query' }, { status: 400 });
  const db = getDb();
  const [product] = await db.select({ id: products.id, name: products.name }).from(products).where(and(eq(products.id, parsed.data.productId), eq(products.workspaceId, workspace.id))).limit(1);
  if (!product) return NextResponse.json({ error: 'Product not found in this workspace.' }, { status: 404 });
  const evidenceFilter = and(eq(metricPoints.workspaceId, workspace.id), eq(metricPoints.productId, product.id), parsed.data.source ? eq(metricPoints.source, parsed.data.source) : undefined);
  const recentDate = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const [[evidence], keys, recent] = await Promise.all([
    db.select({ pointCount: count(), metricCount: countDistinct(metricPoints.metric), latestMetricDate: max(metricPoints.metricDate), lastCollectedAt: max(metricPoints.collectedAt) }).from(metricPoints).where(evidenceFilter),
    db.select({ productId: ingestionApiKeys.productId, lastUsedAt: ingestionApiKeys.lastUsedAt }).from(ingestionApiKeys).where(and(eq(ingestionApiKeys.workspaceId, workspace.id), isNull(ingestionApiKeys.revokedAt), or(isNull(ingestionApiKeys.productId), eq(ingestionApiKeys.productId, product.id)))),
    db.select({ metric: metricPoints.metric, source: metricPoints.source, dimensionsJson: metricPoints.dimensionsJson, metricDate: metricPoints.metricDate }).from(metricPoints).where(and(eq(metricPoints.workspaceId, workspace.id), eq(metricPoints.productId, product.id), gte(metricPoints.metricDate, recentDate))).limit(20000),
  ]);
  const readiness = summarizeAgentReadiness(recent);
  return NextResponse.json({
    product,
    source: parsed.data.source || null,
    evidence: { pointCount: Number(evidence?.pointCount || 0), metricCount: Number(evidence?.metricCount || 0), latestMetricDate: evidence?.latestMetricDate || null, lastCollectedAt: evidence?.lastCollectedAt || null },
    keyHealth: { activeKeys: keys.length, productScopedKeys: keys.filter((key) => key.productId === product.id).length, lastUsedAt: keys.flatMap((key) => key.lastUsedAt ? [key.lastUsedAt] : []).sort().at(-1) || null },
    agentReadiness: Object.fromEntries(Object.entries(readiness).map(([preset, value]) => [preset, { ready: value.ready, evidencePoints: value.eligiblePointCount + value.competitorPointCount }])),
  });
}
