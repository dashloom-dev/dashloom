import { and, desc, eq, gt, isNotNull, isNull, lte, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { agentActionOutcomes, agentActions, analysisRuns, metricPoints } from '@/db/schema';
import { assessActionOutcome, ACTION_OUTCOME_LIMITATION, metricChangePercent, metricOutcomeDirection } from './agent-action-outcome-policy';
import { actionBaselineCutoff, selectLatestActionMeasurement, type ActionOutcomeMeasurement } from './agent-action-outcome-measurement';

const findingSchema = z.object({
  metric: z.string().trim().regex(/^[a-z][a-z0-9_]{1,79}$/).nullable(),
  productId: z.string().uuid().nullable(),
  evidenceRefs: z.array(z.string().max(160)).max(8),
}).passthrough();
const findingsSchema = z.object({ findings: z.array(findingSchema) }).passthrough();
const evidenceSeriesSchema = z.object({
  evidenceId: z.string().max(160),
  productId: z.string().uuid(),
  source: z.string().max(100),
  metric: z.string().max(100),
  currency: z.string().regex(/^[a-z]{3}$/).nullable().optional(),
}).passthrough();
const evidenceSchema = z.object({ series: z.array(evidenceSeriesSchema).max(20000) }).passthrough();

export type AgentActionMetricIdentity = z.infer<typeof evidenceSeriesSchema>;

function parseJson(value: string | null | undefined) {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; }
  catch { return null; }
}

export async function latestAgentMetricMeasurement(workspaceId: string, identity: AgentActionMetricIdentity, options: { onOrBefore?: string; after?: string }): Promise<ActionOutcomeMeasurement | null> {
  const dateFilter = and(options.after ? gt(metricPoints.metricDate, options.after) : undefined, options.onOrBefore ? lte(metricPoints.metricDate, options.onOrBefore) : undefined);
  const rows = await getDb().select({ source: metricPoints.source, metricDate: metricPoints.metricDate, value: metricPoints.value, dimensionsJson: metricPoints.dimensionsJson }).from(metricPoints).where(and(eq(metricPoints.workspaceId, workspaceId), eq(metricPoints.productId, identity.productId), eq(metricPoints.metric, identity.metric), dateFilter)).orderBy(desc(metricPoints.metricDate)).limit(2000);
  return selectLatestActionMeasurement(rows, identity);
}

export async function resolveAgentActionMetricSnapshot(workspaceId: string, actionId: string, capturedAt: string) {
  const db = getDb();
  const [action] = await db.select().from(agentActions).where(and(eq(agentActions.id, actionId), eq(agentActions.workspaceId, workspaceId))).limit(1);
  if (!action) throw new Error('Agent action not found.');
  const [run] = action.sourceAnalysisRunId ? await db.select({ findingsJson: analysisRuns.findingsJson, evidenceJson: analysisRuns.evidenceJson }).from(analysisRuns).where(and(eq(analysisRuns.id, action.sourceAnalysisRunId), eq(analysisRuns.workspaceId, workspaceId))).limit(1) : [];
  const parsedFindings = findingsSchema.safeParse(parseJson(run?.findingsJson));
  const parsedEvidence = evidenceSchema.safeParse(parseJson(run?.evidenceJson));
  const finding = parsedFindings.success ? parsedFindings.data.findings[action.sourceFindingIndex] : null;
  const series = finding && parsedEvidence.success ? parsedEvidence.data.series.find((item) => item.metric === finding.metric && item.productId === finding.productId && finding.evidenceRefs.includes(item.evidenceId)) : null;
  const baseline = series ? await latestAgentMetricMeasurement(workspaceId, series, { onOrBefore: actionBaselineCutoff(series.metric, capturedAt) }) : null;
  return { action, finding, series, baseline };
}

export async function captureAgentActionOutcome(workspaceId: string, actionId: string, completedAt: string) {
  const db = getDb();
  const { action, finding, series, baseline } = await resolveAgentActionMetricSnapshot(workspaceId, actionId, completedAt);
  const assessment = series && baseline ? 'awaiting' as const : 'insufficient' as const;
  const limitation = assessment === 'awaiting' ? ACTION_OUTCOME_LIMITATION : 'The completed action has no product-scoped metric evidence that can be measured safely.';
  const outcome = {
    id: crypto.randomUUID(), workspaceId, actionId, sourceAnalysisRunId: action.sourceAnalysisRunId,
    productId: series?.productId || finding?.productId || null, metric: series?.metric || finding?.metric || null,
    source: series?.source || null, currency: series?.currency || null,
    direction: series ? metricOutcomeDirection(series.metric) : 'contextual' as const,
    baselineEvidenceRef: series?.evidenceId || null, baselineValue: baseline?.value ?? null,
    baselineDate: baseline?.metricDate || null, assessment, limitation, completedAt,
  };
  await db.insert(agentActionOutcomes).values(outcome).onConflictDoNothing({ target: [agentActionOutcomes.actionId, agentActionOutcomes.completedAt] });
  return outcome;
}

export async function refreshAgentActionOutcomes(workspaceId?: string, limit = 200) {
  const db = getDb();
  const missingScope = workspaceId ? and(eq(agentActions.workspaceId, workspaceId), eq(agentActions.status, 'done'), isNotNull(agentActions.completedAt), isNull(agentActionOutcomes.id)) : and(eq(agentActions.status, 'done'), isNotNull(agentActions.completedAt), isNull(agentActionOutcomes.id));
  const missing = await db.select({ actionId: agentActions.id, workspaceId: agentActions.workspaceId, completedAt: agentActions.completedAt }).from(agentActions).leftJoin(agentActionOutcomes, and(eq(agentActionOutcomes.actionId, agentActions.id), eq(agentActionOutcomes.completedAt, agentActions.completedAt))).where(missingScope).orderBy(desc(agentActions.completedAt)).limit(limit);
  let repaired = 0; let repairErrors = 0;
  for (const action of missing) {
    if (!action.completedAt) continue;
    try { await captureAgentActionOutcome(action.workspaceId, action.actionId, action.completedAt); repaired += 1; }
    catch { repairErrors += 1; }
  }
  const scope = workspaceId ? and(eq(agentActionOutcomes.workspaceId, workspaceId), ne(agentActionOutcomes.assessment, 'insufficient')) : ne(agentActionOutcomes.assessment, 'insufficient');
  const outcomes = await db.select().from(agentActionOutcomes).where(scope).orderBy(desc(agentActionOutcomes.completedAt)).limit(limit);
  let measured = 0; let awaiting = 0;
  for (const outcome of outcomes) {
    if (!outcome.productId || !outcome.metric || !outcome.source || outcome.baselineValue === null || !outcome.baselineDate) continue;
    const identity: AgentActionMetricIdentity = { evidenceId: outcome.baselineEvidenceRef || 'outcome', productId: outcome.productId, metric: outcome.metric, source: outcome.source, currency: outcome.currency };
    const latest = await latestAgentMetricMeasurement(outcome.workspaceId, identity, { after: outcome.baselineDate });
    if (!latest) { awaiting += 1; continue; }
    const measuredAt = new Date().toISOString();
    await db.update(agentActionOutcomes).set({ latestValue: latest.value, latestDate: latest.metricDate, changePercent: metricChangePercent(outcome.baselineValue, latest.value), assessment: assessActionOutcome(outcome.direction, outcome.baselineValue, latest.value), measuredAt, updatedAt: measuredAt }).where(and(eq(agentActionOutcomes.id, outcome.id), eq(agentActionOutcomes.workspaceId, outcome.workspaceId)));
    measured += 1;
  }
  return { inspected: outcomes.length, measured, awaiting, repaired, repairErrors };
}
