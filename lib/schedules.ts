import { and, asc, eq, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { reportSchedules } from '@/db/schema';
import { AgentPreset } from './agent';
import { generateExecutiveWorkspaceReport, generateWorkspaceReport } from './reports';
import { nextScheduleRun } from './schedule-time';
import { assertReportScheduleBatchSucceeded, reportScheduleErrorCode, reportScheduleOccurrenceAt, reportScheduleRetryAt } from './report-schedule-policy';
import { parseExecutiveSchedulePresets } from './executive-report';
import { normalizeAgentProductScope } from './agent-scope';

export { nextScheduleRun } from './schedule-time';

export async function processDueReportSchedules(limit = 20) {
  const db = getDb(); const now = new Date();
  const due = await db.select().from(reportSchedules).where(and(eq(reportSchedules.enabled, true), lte(reportSchedules.nextRunAt, now.toISOString()))).orderBy(asc(reportSchedules.nextRunAt)).limit(limit);
  const results = [];
  for (const schedule of due) {
    const occurrenceAt = reportScheduleOccurrenceAt(schedule.activeOccurrenceAt, schedule.nextRunAt);
    const nextRunAt = nextScheduleRun(schedule, new Date(schedule.nextRunAt));
    const claimed = await db.update(reportSchedules).set({ nextRunAt, activeOccurrenceAt: occurrenceAt, lastRunAt: now.toISOString(), updatedAt: now.toISOString() }).where(and(eq(reportSchedules.id, schedule.id), eq(reportSchedules.nextRunAt, schedule.nextRunAt))).returning({ id: reportSchedules.id });
    if (!claimed.length) continue;
    try {
      let report;
      const scope = normalizeAgentProductScope({ mode: schedule.scopeMode, productId: schedule.productId });
      if (schedule.kind === 'executive') {
        if (!schedule.createdByUserId) throw new Error('Executive Brief schedule has no creator.');
        const presets = parseExecutiveSchedulePresets(schedule.executivePresetsJson);
        report = await generateExecutiveWorkspaceReport({ workspaceId: schedule.workspaceId, createdByUserId: schedule.createdByUserId, presets, question: schedule.executiveQuestion || 'What needs executive attention first, why does it matter, and what should the team do next?', cadence: schedule.cadence, idempotencyKey: `${schedule.id}:${occurrenceAt}`, scope });
      } else report = await generateWorkspaceReport(schedule.workspaceId, schedule.agentPreset as AgentPreset, schedule.cadence, `${schedule.id}:${occurrenceAt}`, scope);
      await db.update(reportSchedules).set({ lastStatus: 'success', lastErrorCode: null, consecutiveFailures: 0, activeOccurrenceAt: null, updatedAt: new Date().toISOString() }).where(eq(reportSchedules.id, schedule.id));
      results.push({ scheduleId: schedule.id, reportId: report.id, status: 'ready' });
    } catch (error) {
      const consecutiveFailures = schedule.consecutiveFailures + 1;
      const errorCode = reportScheduleErrorCode(error);
      await db.update(reportSchedules).set({ nextRunAt: reportScheduleRetryAt(consecutiveFailures), lastStatus: 'error', lastErrorCode: errorCode, consecutiveFailures, updatedAt: new Date().toISOString() }).where(eq(reportSchedules.id, schedule.id));
      results.push({ scheduleId: schedule.id, status: 'error', errorCode });
    }
  }
  assertReportScheduleBatchSucceeded(results);
  return { processed: results.length, results };
}
