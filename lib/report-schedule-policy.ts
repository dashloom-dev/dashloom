export type ReportScheduleErrorCode = 'MODEL_UNAVAILABLE' | 'EVIDENCE_UNAVAILABLE' | 'AGENT_DISABLED' | 'DELIVERY_FAILED' | 'REPORT_GENERATION_FAILED';

export function reportScheduleErrorCode(error: unknown): ReportScheduleErrorCode {
  const message = error instanceof Error ? error.message : '';
  if (/provider|model/i.test(message)) return 'MODEL_UNAVAILABLE';
  if (/sync evidence|matching evidence/i.test(message)) return 'EVIDENCE_UNAVAILABLE';
  if (/disabled/i.test(message)) return 'AGENT_DISABLED';
  if (/delivery|channel/i.test(message)) return 'DELIVERY_FAILED';
  return 'REPORT_GENERATION_FAILED';
}

export function reportScheduleRetryAt(consecutiveFailures: number, now = new Date()) {
  const exponent = Math.max(0, Math.min(5, consecutiveFailures - 1));
  const delayMinutes = Math.min(360, 15 * (2 ** exponent));
  return new Date(now.getTime() + delayMinutes * 60_000).toISOString();
}

export function assertReportScheduleBatchSucceeded(results: readonly { status: string }[]) {
  if (results.some((result) => result.status === 'error')) throw new Error('One or more scheduled reports failed.');
}

export function reportScheduleOccurrenceAt(activeOccurrenceAt: string | null, plannedAt: string) {
  return activeOccurrenceAt || plannedAt;
}
