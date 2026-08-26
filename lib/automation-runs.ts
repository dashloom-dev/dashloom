import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '@/db';
import { automationRuns } from '@/db/schema';
import { summarizeAutomationResults, type AutomationTaskSummary } from '@/lib/automation-run-policy';

export { scheduledExecutionKey } from '@/lib/automation-run-policy';

export type AutomationKind = typeof automationRuns.$inferInsert.kind;
export type AutomationTask = { name: string; run: () => Promise<unknown> };
export async function executeAutomationRun(input: { executionKey: string; kind: AutomationKind; trigger: 'scheduled' | 'manual'; cron?: string; scheduledTime?: string; tasks: AutomationTask[] }) {
  const db = getDb(); const id = crypto.randomUUID(); const startedAt = new Date().toISOString();
  let claimed = await db.insert(automationRuns).values({ id, executionKey: input.executionKey, kind: input.kind, trigger: input.trigger, cron: input.cron, scheduledTime: input.scheduledTime, startedAt }).onConflictDoNothing({ target: automationRuns.executionKey }).returning({ id: automationRuns.id });
  if (!claimed.length) {
    const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    claimed = await db.update(automationRuns).set({ startedAt, finishedAt: null, summaryJson: '{"tasks":[]}' }).where(and(eq(automationRuns.executionKey, input.executionKey), eq(automationRuns.status, 'running'), lt(automationRuns.startedAt, staleBefore))).returning({ id: automationRuns.id });
  }
  if (!claimed.length) return { replayed: true, status: 'success' as const, tasks: [] as AutomationTaskSummary[] };
  const results = await Promise.allSettled(input.tasks.map((task) => task.run()));
  const summary = summarizeAutomationResults(input.tasks.map((task) => task.name), results);
  await db.update(automationRuns).set({ status: summary.status, summaryJson: JSON.stringify({ tasks: summary.tasks }), finishedAt: new Date().toISOString() }).where(eq(automationRuns.id, claimed[0].id));
  return { replayed: false, ...summary };
}
export function manualExecutionKey(kind: AutomationKind) { return `manual:${kind}:${crypto.randomUUID()}`; }
