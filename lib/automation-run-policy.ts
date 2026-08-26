export type AutomationTaskSummary = { name: string; status: 'success' | 'error'; errorCode?: string };

export function scheduledExecutionKey(cron: string, scheduledTime: number) { return `cron:${cron}:${scheduledTime}`; }
export function automationErrorCode(taskName: string) { return `${taskName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toUpperCase() || 'TASK'}_FAILED`; }
export function summarizeAutomationResults(taskNames: string[], results: PromiseSettledResult<unknown>[]) {
  const tasks: AutomationTaskSummary[] = results.map((result, index) => result.status === 'fulfilled' ? { name: taskNames[index], status: 'success' } : { name: taskNames[index], status: 'error', errorCode: automationErrorCode(taskNames[index]) });
  const succeeded = tasks.filter((task) => task.status === 'success').length;
  const status = succeeded === tasks.length ? 'success' : succeeded === 0 ? 'error' : 'partial';
  return { status: status as 'success' | 'partial' | 'error', tasks };
}
