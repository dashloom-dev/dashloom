import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentActionOccurrences, agentActions } from '@/db/schema';
import type { AgentResult } from './agent';
import { agentActionFingerprint } from './agent-action-policy';

export async function materializeAgentActions(workspaceId: string, analysisRunId: string, result: AgentResult, seenAt = new Date().toISOString()) {
  const db = getDb();
  for (let index = 0; index < result.findings.length; index += 1) {
    const finding = result.findings[index]; const fingerprint = await agentActionFingerprint({ productId: finding.productId, title: finding.title, action: finding.action });
    await db.insert(agentActions).values({ id: crypto.randomUUID(), workspaceId, fingerprint, sourceAnalysisRunId: analysisRunId, sourceFindingIndex: index, productId: finding.productId, title: finding.title, detail: finding.detail, recommendedAction: finding.action, severity: finding.severity, confidence: finding.confidence, evidenceRefsJson: JSON.stringify(finding.evidenceRefs), status: 'suggested', occurrenceCount: 0, firstSeenAt: seenAt, lastSeenAt: seenAt }).onConflictDoNothing();
    const [action] = await db.select({ id: agentActions.id }).from(agentActions).where(and(eq(agentActions.workspaceId, workspaceId), eq(agentActions.fingerprint, fingerprint))).limit(1); if (!action) throw new Error('Agent action could not be resolved.');
    const occurrence = await db.insert(agentActionOccurrences).values({ id: crypto.randomUUID(), workspaceId, actionId: action.id, analysisRunId, findingIndex: index, evidenceRefsJson: JSON.stringify(finding.evidenceRefs), seenAt }).onConflictDoNothing().returning({ id: agentActionOccurrences.id });
    if (occurrence.length) await db.update(agentActions).set({ sourceAnalysisRunId: analysisRunId, sourceFindingIndex: index, productId: finding.productId, title: finding.title, detail: finding.detail, recommendedAction: finding.action, severity: finding.severity, confidence: finding.confidence, evidenceRefsJson: JSON.stringify(finding.evidenceRefs), status: sql`case when ${agentActions.status} = 'done' then 'suggested' else ${agentActions.status} end`, occurrenceCount: sql`${agentActions.occurrenceCount} + 1`, completedAt: sql`case when ${agentActions.status} = 'done' then null else ${agentActions.completedAt} end`, lastSeenAt: seenAt, updatedAt: seenAt }).where(and(eq(agentActions.id, action.id), eq(agentActions.workspaceId, workspaceId)));
  }
}
