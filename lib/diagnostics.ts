import { count, desc, eq, max } from 'drizzle-orm';
import { getDb } from '@/db';
import { analysisRuns, connectorAccounts, metricPoints, products, reports, syncRuns, workspaceMembers, workspaces } from '@/db/schema';
import { anonymousDiagnosticsSchema } from './diagnostic-contract';

export async function buildAnonymousDiagnostics(workspaceId: string) {
  const db = getDb(); const [workspace] = await db.select({ plan: workspaces.plan }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1); if (!workspace) throw new Error('Workspace not found.');
  const [productTotal, memberTotal, metricTotal, freshness, connectorHealth, metricSources, recentSyncs, recentAgentRuns, recentReports] = await Promise.all([
    db.select({ value: count() }).from(products).where(eq(products.workspaceId, workspaceId)),
    db.select({ value: count() }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId)),
    db.select({ value: count() }).from(metricPoints).where(eq(metricPoints.workspaceId, workspaceId)),
    db.select({ value: max(metricPoints.metricDate) }).from(metricPoints).where(eq(metricPoints.workspaceId, workspaceId)),
    db.select({ provider: connectorAccounts.provider, status: connectorAccounts.status, value: count() }).from(connectorAccounts).where(eq(connectorAccounts.workspaceId, workspaceId)).groupBy(connectorAccounts.provider, connectorAccounts.status),
    db.select({ source: metricPoints.source, value: count() }).from(metricPoints).where(eq(metricPoints.workspaceId, workspaceId)).groupBy(metricPoints.source),
    db.select({ source: syncRuns.source, status: syncRuns.status, errorCode: syncRuns.errorCode, recordsWritten: syncRuns.recordsWritten, startedAt: syncRuns.startedAt, finishedAt: syncRuns.finishedAt }).from(syncRuns).where(eq(syncRuns.workspaceId, workspaceId)).orderBy(desc(syncRuns.startedAt)).limit(20),
    db.select({ trigger: analysisRuns.trigger, status: analysisRuns.status, errorCode: analysisRuns.errorCode, createdAt: analysisRuns.createdAt, finishedAt: analysisRuns.finishedAt }).from(analysisRuns).where(eq(analysisRuns.workspaceId, workspaceId)).orderBy(desc(analysisRuns.createdAt)).limit(10),
    db.select({ cadence: reports.cadence, status: reports.status, periodEnd: reports.periodEnd, createdAt: reports.createdAt }).from(reports).where(eq(reports.workspaceId, workspaceId)).orderBy(desc(reports.createdAt)).limit(10),
  ]);
  return anonymousDiagnosticsSchema.parse({
    schemaVersion: 1, generatedAt: new Date().toISOString(), application: { name: 'Dashloom', version: '0.1.0' },
    workspace: { plan: workspace.plan, products: Number(productTotal[0]?.value || 0), members: Number(memberTotal[0]?.value || 0) },
    connectors: connectorHealth.map((row) => ({ provider: row.provider, status: row.status, count: Number(row.value) })),
    metrics: { points: Number(metricTotal[0]?.value || 0), freshThrough: freshness[0]?.value || null, sources: metricSources.map((row) => ({ source: row.source, count: Number(row.value) })) },
    synchronization: recentSyncs, agent: recentAgentRuns, reports: recentReports,
    privacy: { excluded: ['workspace identifiers', 'user identity', 'product names and domains', 'credentials', 'raw metric values', 'custom metric names', 'questions and Agent findings', 'report content', 'provider error messages'] },
  });
}
