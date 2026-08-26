import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { competitorMetricPoints, competitors, metricPoints } from '@/db/schema';
import { comparisonWindow } from './analysis-window';
import { summarizeAgentReadiness } from './agent-catalog';

function day(offset: number) { return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10); }

export async function getWorkspaceAgentReadiness(workspaceId: string, productId: string | null = null) {
  const window = comparisonWindow('chat');
  const start = day(window.startOffset);
  const [rows, competitorRows] = await Promise.all([
    getDb().select({ metric: metricPoints.metric, source: metricPoints.source, domain: sql<string | null>`case when json_valid(${metricPoints.dimensionsJson}) then json_extract(${metricPoints.dimensionsJson}, '$.domain') else null end`, metricDate: sql<string>`max(${metricPoints.metricDate})`, pointCount: count() }).from(metricPoints).where(and(eq(metricPoints.workspaceId, workspaceId), productId ? eq(metricPoints.productId, productId) : undefined, gte(metricPoints.metricDate, start))).groupBy(metricPoints.metric, metricPoints.source, sql`case when json_valid(${metricPoints.dimensionsJson}) then json_extract(${metricPoints.dimensionsJson}, '$.domain') else null end`).orderBy(desc(sql`max(${metricPoints.metricDate})`)).limit(20000),
    getDb().select({ metric: competitorMetricPoints.metric, source: competitorMetricPoints.source, domain: sql<string | null>`case when json_valid(${competitorMetricPoints.dimensionsJson}) then json_extract(${competitorMetricPoints.dimensionsJson}, '$.domain') else null end`, metricDate: sql<string>`max(${competitorMetricPoints.metricDate})`, pointCount: count() }).from(competitorMetricPoints).innerJoin(competitors, eq(competitorMetricPoints.competitorId, competitors.id)).where(and(eq(competitorMetricPoints.workspaceId, workspaceId), productId ? eq(competitors.productId, productId) : undefined, gte(competitorMetricPoints.metricDate, start))).groupBy(competitorMetricPoints.metric, competitorMetricPoints.source, sql`case when json_valid(${competitorMetricPoints.dimensionsJson}) then json_extract(${competitorMetricPoints.dimensionsJson}, '$.domain') else null end`).limit(5000),
  ]);
  return summarizeAgentReadiness(rows, competitorRows);
}

export async function getWorkspaceAgentReadinessByProduct(workspaceId: string, requestedProductIds: string[]) {
  const productIds = [...new Set(requestedProductIds)].slice(0, 100);
  if (!productIds.length) return {};
  const start = day(comparisonWindow('chat').startOffset);
  const [rows, competitorRows] = await Promise.all([
    getDb().select({ productId: metricPoints.productId, metric: metricPoints.metric, source: metricPoints.source, domain: sql<string | null>`case when json_valid(${metricPoints.dimensionsJson}) then json_extract(${metricPoints.dimensionsJson}, '$.domain') else null end`, metricDate: sql<string>`max(${metricPoints.metricDate})`, pointCount: count() }).from(metricPoints).where(and(eq(metricPoints.workspaceId, workspaceId), inArray(metricPoints.productId, productIds), gte(metricPoints.metricDate, start))).groupBy(metricPoints.productId, metricPoints.metric, metricPoints.source, sql`case when json_valid(${metricPoints.dimensionsJson}) then json_extract(${metricPoints.dimensionsJson}, '$.domain') else null end`).limit(20000),
    getDb().select({ productId: competitors.productId, metric: competitorMetricPoints.metric, source: competitorMetricPoints.source, domain: sql<string | null>`case when json_valid(${competitorMetricPoints.dimensionsJson}) then json_extract(${competitorMetricPoints.dimensionsJson}, '$.domain') else null end`, metricDate: sql<string>`max(${competitorMetricPoints.metricDate})`, pointCount: count() }).from(competitorMetricPoints).innerJoin(competitors, eq(competitorMetricPoints.competitorId, competitors.id)).where(and(eq(competitorMetricPoints.workspaceId, workspaceId), inArray(competitors.productId, productIds), gte(competitorMetricPoints.metricDate, start))).groupBy(competitors.productId, competitorMetricPoints.metric, competitorMetricPoints.source, sql`case when json_valid(${competitorMetricPoints.dimensionsJson}) then json_extract(${competitorMetricPoints.dimensionsJson}, '$.domain') else null end`).limit(5000),
  ]);
  return Object.fromEntries(productIds.map((productId) => [productId, summarizeAgentReadiness(rows.filter((row) => row.productId === productId), competitorRows.filter((row) => row.productId === productId))]));
}
