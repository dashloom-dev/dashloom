import app from 'vinext/server/app-router-entry';
import { processDueReportSchedules } from './lib/schedules';
import { processDueSyncSchedules } from './lib/sync-schedules';
import { executeAutomationRun, scheduledExecutionKey } from './lib/automation-runs';
import { refreshAgentActionOutcomes } from './lib/agent-action-outcomes';
import { refreshAgentGrowthMissions } from './lib/agent-growth-missions';

const worker = {
  fetch: app.fetch,
  scheduled(controller: ScheduledController, _env: unknown, context: ExecutionContext) {
    const task = executeAutomationRun({ executionKey: scheduledExecutionKey(controller.cron, controller.scheduledTime), kind: 'quarter_hourly', trigger: 'scheduled', cron: controller.cron, scheduledTime: new Date(controller.scheduledTime).toISOString(), tasks: [{ name: 'reports', run: processDueReportSchedules }, { name: 'sync_outcomes', run: async () => { await processDueSyncSchedules(); await refreshAgentActionOutcomes(); return refreshAgentGrowthMissions(); } }] });
    context.waitUntil(task.then((result) => { if (result.replayed) controller.noRetry(); if (result.status !== 'success') console.error(JSON.stringify({ event: 'scheduled_run_incomplete', cron: controller.cron, status: result.status, tasks: result.tasks })); }).catch((error) => console.error(JSON.stringify({ event: 'scheduled_run_failed', cron: controller.cron, error: error instanceof Error ? error.message : String(error) }))));
  },
};

export default worker;
