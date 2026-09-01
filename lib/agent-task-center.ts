export type AgentTaskStatus = 'queued' | 'running' | 'success' | 'error' | 'cancelled';

export type AgentTaskRetry = {
  state: 'in_progress' | 'not_needed' | 'available' | 'unavailable';
  label: string;
  reason: string;
};

export function normalizeAnalysisRequestQuestion(value: unknown) {
  const question = typeof value === 'string' ? value.trim() : '';
  return question.length >= 3 && question.length <= 1000 ? question : null;
}

export function parseAnalysisRequestQuestion(evidenceJson: string) {
  try { return normalizeAnalysisRequestQuestion((JSON.parse(evidenceJson) as { request?: { question?: unknown } }).request?.question); }
  catch { return null; }
}

export function agentTaskRetry(input: {
  status: AgentTaskStatus;
  question: string | null;
  conversationId: string | null;
  conversationActive: boolean;
  scopeAvailable: boolean;
}): AgentTaskRetry {
  if (input.status === 'queued' || input.status === 'running') return { state: 'in_progress', label: 'In progress', reason: 'This task is still being processed.' };
  if (input.status === 'success') return { state: 'not_needed', label: 'Completed', reason: 'The task completed successfully and does not need a retry.' };
  if (!input.conversationId) return { state: 'unavailable', label: 'Manual restart', reason: 'Scheduled and legacy tasks must be started again from the Agent workspace.' };
  if (!input.conversationActive) return { state: 'unavailable', label: 'Conversation closed', reason: 'This task belongs to an archived or removed conversation.' };
  if (!input.scopeAvailable) return { state: 'unavailable', label: 'Scope unavailable', reason: 'The product used by this task is no longer available.' };
  if (!input.question) return { state: 'unavailable', label: 'Prompt unavailable', reason: 'The original prompt cannot be recovered safely.' };
  return { state: 'available', label: 'Ready to retry', reason: 'Retry with the original prompt, locked scope, fresh evidence, and current quota checks.' };
}

export function agentTaskDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  const end = finishedAt ? Date.parse(finishedAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const seconds = Math.max(1, Math.round((end - start) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
