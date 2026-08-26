import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentExecutiveBriefs, aiProviderAccounts } from '@/db/schema';
import { runWorkspaceAgent } from './agent';
import { type AgentPreset } from './agent-catalog';
import { getWorkspaceAgentReadiness } from './agent-readiness';
import { buildExecutiveDigest, selectExecutivePresets, type ExecutiveSpecialistResult } from './executive-brief';
import { normalizeAgentProductScope, type AgentProductScope } from './agent-scope';

type ExecutiveTrigger = 'manual' | 'daily' | 'weekly' | 'monthly';

function failureCode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('allowance') || message.includes('quota')) return 'AI_CAPACITY_EXHAUSTED';
  if (message.includes('matching evidence') || message.includes('sync evidence')) return 'EVIDENCE_UNAVAILABLE';
  if (message.includes('provider') || message.includes('model') || message.includes('api key')) return 'MODEL_UNAVAILABLE';
  return 'ANALYSIS_FAILED';
}

export async function executiveBriefCapacity(workspaceId: string, policy: 'remaining' | 'dailyLimit' = 'remaining') {
  void policy;
  const providers = await getDb().select({ mode: aiProviderAccounts.mode }).from(aiProviderAccounts).where(and(eq(aiProviderAccounts.workspaceId, workspaceId), eq(aiProviderAccounts.status, 'connected'))).orderBy(desc(aiProviderAccounts.createdAt));
  const byok = providers.some((provider) => provider.mode === 'byok');
  if (byok) return { mode: 'byok' as const, capacity: 5, remaining: null, ready: true };
  return { mode: 'byok' as const, capacity: 0, remaining: null, ready: false };
}

export async function executiveBriefPreflight(workspaceId: string, presets: AgentPreset[], capacityPolicy: 'remaining' | 'dailyLimit' = 'remaining', scope: AgentProductScope = { mode: 'workspace', productId: null }) {
  const [readiness, capacity] = await Promise.all([getWorkspaceAgentReadiness(workspaceId, scope.productId), executiveBriefCapacity(workspaceId, capacityPolicy)]);
  if (!capacity.ready) throw new Error('Connect a BYOK model before running an Executive Brief.');
  const selection = selectExecutivePresets({ requested: presets, readiness, capacity: capacity.capacity });
  if (selection.code === 'AT_LEAST_TWO_SPECIALISTS') throw new Error('Select at least two specialists.');
  if (selection.code === 'SPECIALIST_NOT_READY') throw new Error(`Some selected specialists need matching recent evidence: ${selection.unavailable.join(', ')}.`);
  if (selection.code === 'INSUFFICIENT_AI_CAPACITY') throw new Error(capacityPolicy === 'dailyLimit' ? `This schedule needs ${presets.length} AI runs per occurrence, but this plan supports ${capacity.capacity}. Deselect specialists or connect BYOK.` : `This brief needs ${presets.length} AI runs, but only ${capacity.capacity} managed run${capacity.capacity === 1 ? '' : 's'} remain today. Deselect specialists or connect BYOK.`);
  return { selection, capacity, readiness };
}

export async function runExecutiveBrief(input: { workspaceId: string; createdByUserId: string; question: string; presets: AgentPreset[]; trigger?: ExecutiveTrigger; scope?: AgentProductScope }) {
  const scope = normalizeAgentProductScope(input.scope || { mode: 'workspace' as const, productId: null });
  const { selection } = await executiveBriefPreflight(input.workspaceId, input.presets, 'remaining', scope);

  const db = getDb();
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await db.insert(agentExecutiveBriefs).values({ id, workspaceId: input.workspaceId, scopeMode: scope.mode, productId: scope.productId, question: input.question, requestedPresetsJson: JSON.stringify(selection.selected), createdByUserId: input.createdByUserId, startedAt });
  const settled = await Promise.allSettled(selection.selected.map((preset) => runWorkspaceAgent(input.workspaceId, input.question, preset, input.trigger || 'manual', null, scope)));
  const successes: ExecutiveSpecialistResult[] = [];
  const failures: Array<{ preset: AgentPreset; code: string }> = [];
  settled.forEach((result, index) => {
    const preset = selection.selected[index];
    if (result.status === 'fulfilled') successes.push({ preset, runId: result.value.runId, summary: result.value.findings.summary, findings: result.value.findings.findings });
    else failures.push({ preset, code: failureCode(result.reason) });
  });
  const digest = successes.length ? buildExecutiveDigest(successes) : null;
  const status = successes.length === selection.selected.length ? 'success' as const : successes.length ? 'partial' as const : 'error' as const;
  const finishedAt = new Date().toISOString();
  await db.update(agentExecutiveBriefs).set({ analysisRunIdsJson: JSON.stringify(successes.map((result) => ({ preset: result.preset, runId: result.runId }))), digestJson: digest ? JSON.stringify(digest) : null, failuresJson: JSON.stringify(failures), status, successCount: successes.length, failureCount: failures.length, finishedAt }).where(and(eq(agentExecutiveBriefs.id, id), eq(agentExecutiveBriefs.workspaceId, input.workspaceId)));
  return { id, status, successes: successes.length, failures: failures.length, digest };
}
