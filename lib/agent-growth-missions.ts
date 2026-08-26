import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentGrowthMissions } from '@/db/schema';
import { latestAgentMetricMeasurement, resolveAgentActionMetricSnapshot, type AgentActionMetricIdentity } from './agent-action-outcomes';
import { actionBaselineCutoff } from './agent-action-outcome-measurement';
import { assessGrowthMission, GROWTH_MISSION_LIMITATION, growthMissionProgressPercent } from './agent-growth-mission-policy';

export async function createAgentGrowthMission(input: {
  workspaceId: string;
  actionId: string;
  title?: string;
  hypothesis: string;
  targetDirection: 'increase' | 'decrease';
  targetChangePercent: number;
  dueAt: string;
  assignedUserId: string | null;
  createdByUserId: string;
}) {
  const startedAt = new Date().toISOString();
  if (new Date(input.dueAt).getTime() <= Date.now()) throw new Error('Mission due date must be in the future.');
  const { action, series, baseline } = await resolveAgentActionMetricSnapshot(input.workspaceId, input.actionId, startedAt);
  if (!series || !baseline) throw new Error('This action has no measurable product metric evidence. Run an Agent with product-level evidence first.');
  if (!Number.isFinite(input.targetChangePercent) || input.targetChangePercent <= 0 || input.targetChangePercent > 10000) throw new Error('Target change must be between 0 and 10,000 percent.');
  if (input.targetDirection === 'decrease' && input.targetChangePercent > 100) throw new Error('A decrease target cannot exceed 100 percent.');
  if (baseline.value === 0) throw new Error('A percentage mission cannot start from a zero baseline. Sync a non-zero metric observation first.');
  const targetValue = baseline.value * (1 + (input.targetDirection === 'increase' ? 1 : -1) * input.targetChangePercent / 100);
  const id = crypto.randomUUID();
  const row = {
    id,
    workspaceId: input.workspaceId,
    sourceActionId: action.id,
    sourceActionOccurrenceCount: action.occurrenceCount,
    sourceAnalysisRunId: action.sourceAnalysisRunId,
    productId: series.productId,
    title: (input.title?.trim() || action.title).slice(0, 160),
    hypothesis: input.hypothesis.trim().slice(0, 700),
    metric: series.metric,
    source: series.source,
    currency: series.currency || null,
    baselineEvidenceRef: series.evidenceId,
    baselineValue: baseline.value,
    baselineDate: baseline.metricDate,
    targetValue,
    latestValue: baseline.value,
    latestDate: baseline.metricDate,
    progressPercent: 0,
    status: 'active' as const,
    assessment: 'awaiting' as const,
    limitation: GROWTH_MISSION_LIMITATION,
    assignedUserId: input.assignedUserId,
    createdByUserId: input.createdByUserId,
    startsAt: startedAt,
    dueAt: input.dueAt,
  };
  const inserted = await getDb().insert(agentGrowthMissions).values(row).onConflictDoNothing({ target: [agentGrowthMissions.sourceActionId, agentGrowthMissions.sourceActionOccurrenceCount] }).returning({ id: agentGrowthMissions.id });
  if (!inserted.length) throw new Error('This occurrence of the Agent action already has a growth mission.');
  return row;
}

export async function refreshAgentGrowthMissions(workspaceId?: string, limit = 200, now = new Date()) {
  const db = getDb();
  const scope = workspaceId ? and(eq(agentGrowthMissions.workspaceId, workspaceId), eq(agentGrowthMissions.status, 'active')) : eq(agentGrowthMissions.status, 'active');
  const missions = await db.select().from(agentGrowthMissions).where(scope).orderBy(asc(agentGrowthMissions.dueAt)).limit(limit);
  let measured = 0; let achieved = 0; let missed = 0; let insufficient = 0; let awaiting = 0;
  for (const mission of missions) {
    if (!mission.productId) {
      await db.update(agentGrowthMissions).set({ status: 'insufficient', assessment: 'insufficient', finishedAt: now.toISOString(), measuredAt: now.toISOString(), updatedAt: now.toISOString() }).where(and(eq(agentGrowthMissions.id, mission.id), eq(agentGrowthMissions.workspaceId, mission.workspaceId), eq(agentGrowthMissions.status, 'active')));
      insufficient += 1;
      continue;
    }
    const identity: AgentActionMetricIdentity = { evidenceId: mission.baselineEvidenceRef, productId: mission.productId, metric: mission.metric, source: mission.source, currency: mission.currency };
    const measurementAt = new Date(Math.min(now.getTime(), new Date(mission.dueAt).getTime()));
    const latest = await latestAgentMetricMeasurement(mission.workspaceId, identity, { after: mission.baselineDate, onOrBefore: actionBaselineCutoff(mission.metric, measurementAt.toISOString()) });
    const result = assessGrowthMission({ baseline: mission.baselineValue, target: mission.targetValue, latest: latest?.value ?? null, dueAt: mission.dueAt, now });
    const status = result.terminal ? result.assessment === 'achieved' ? 'achieved' : result.assessment === 'missed' ? 'missed' : 'insufficient' : 'active';
    const updated = await db.update(agentGrowthMissions).set({
      latestValue: latest?.value ?? mission.latestValue,
      latestDate: latest?.metricDate ?? mission.latestDate,
      changePercent: latest ? mission.baselineValue === 0 ? null : ((latest.value - mission.baselineValue) / Math.abs(mission.baselineValue)) * 100 : mission.changePercent,
      progressPercent: latest ? growthMissionProgressPercent(mission.baselineValue, mission.targetValue, latest.value) ?? mission.progressPercent : mission.progressPercent,
      assessment: result.assessment,
      status,
      measuredAt: now.toISOString(),
      finishedAt: result.terminal ? now.toISOString() : null,
      updatedAt: now.toISOString(),
    }).where(and(eq(agentGrowthMissions.id, mission.id), eq(agentGrowthMissions.workspaceId, mission.workspaceId), inArray(agentGrowthMissions.status, ['active']))).returning({ id: agentGrowthMissions.id });
    if (!updated.length) continue;
    if (latest) measured += 1;
    if (status === 'achieved') achieved += 1;
    else if (status === 'missed') missed += 1;
    else if (status === 'insufficient') insufficient += 1;
    else awaiting += 1;
  }
  return { inspected: missions.length, measured, achieved, missed, insufficient, awaiting };
}
