import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentComparisonResults, agentComparisonRuns, agentProfiles, aiProviderAccounts, aiUsageEvents } from '@/db/schema';
import { AGENT_PROMPT_VERSION, buildEvidence, invokeAgentProvider, loadAgentEvidenceSkills, type AgentPreset } from './agent';
import { evaluateComparisonResult } from './agent-comparison-evaluation';
import { agentPlaybookEvidence, defaultAgentPlaybook, parseAgentPlaybook } from './agent-playbook';

type ComparisonEvidence = Awaited<ReturnType<typeof buildEvidence>> & Record<string, unknown>;

export async function runAgentComparison(input: { workspaceId: string; createdByUserId: string; providerIds: string[]; preset: AgentPreset; question: string }) {
  const db = getDb();
  const providerIds = [...new Set(input.providerIds)];
  if (providerIds.length < 2 || providerIds.length > 4) throw new Error('Select between two and four connected AI providers.');
  const providers = await db.select().from(aiProviderAccounts).where(and(
    eq(aiProviderAccounts.workspaceId, input.workspaceId),
    eq(aiProviderAccounts.status, 'connected'),
    eq(aiProviderAccounts.mode, 'byok'),
    inArray(aiProviderAccounts.id, providerIds),
  ));
  if (providers.length !== providerIds.length) throw new Error('Every selected BYOK provider must be connected in this workspace.');

  const baseEvidence = await buildEvidence(input.workspaceId, input.preset, 'manual');
  if (!baseEvidence.series.length && !baseEvidence.competitors.length && !baseEvidence.competitorTrends.length) throw new Error('Sync evidence supported by this specialist before comparing models.');
  const skills = await loadAgentEvidenceSkills(input.workspaceId, input.preset);
  const [profile] = await db.select({ instructionsJson: agentProfiles.instructionsJson }).from(agentProfiles).where(and(eq(agentProfiles.workspaceId, input.workspaceId), eq(agentProfiles.preset, input.preset))).limit(1);
  const playbook = profile ? parseAgentPlaybook(profile.instructionsJson, input.preset) : defaultAgentPlaybook(input.preset);
  const evidence: ComparisonEvidence = { ...baseEvidence, agentPromptVersion: AGENT_PROMPT_VERSION, operatorPlaybook: agentPlaybookEvidence(input.preset, playbook), request: { question: input.question.slice(0, 1000) }, conversation: null, skills: skills.evidenceSkills, skillValidation: { policyVersion: skills.policyVersion, rejected: skills.rejected }, comparison: { providerCount: providers.length } };
  const comparisonId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await db.insert(agentComparisonRuns).values({ id: comparisonId, workspaceId: input.workspaceId, agentPreset: input.preset, question: input.question.slice(0, 1000), promptVersion: AGENT_PROMPT_VERSION, evidenceJson: JSON.stringify(evidence), providerCount: providers.length, status: 'running', createdByUserId: input.createdByUserId, startedAt });
  const resultRows = providers.map((provider) => ({ id: crypto.randomUUID(), workspaceId: input.workspaceId, comparisonRunId: comparisonId, aiProviderAccountId: provider.id, providerName: provider.displayName, providerMode: provider.mode, model: provider.model, promptVersion: AGENT_PROMPT_VERSION, status: 'running' as const, startedAt }));
  await db.insert(agentComparisonResults).values(resultRows);

  const outcomes = await Promise.all(providers.map(async (provider) => {
    const row = resultRows.find((item) => item.aiProviderAccountId === provider.id)!;
    try {
      const output = await invokeAgentProvider(input.workspaceId, provider, input.question, input.preset, evidence, skills.evidenceSkills);
      const evaluation = evaluateComparisonResult(output.findings, evidence);
      const finishedAt = new Date().toISOString();
      await db.insert(aiUsageEvents).values({ id: crypto.randomUUID(), workspaceId: input.workspaceId, analysisRunId: null, idempotencyKey: `comparison:${row.id}`, source: 'byok', model: provider.model, inputTokens: output.inputTokens, outputTokens: output.outputTokens });
      await db.update(agentComparisonResults).set({ status: 'success', findingsJson: JSON.stringify(output.findings), evaluationJson: JSON.stringify(evaluation), inputTokens: output.inputTokens, outputTokens: output.outputTokens, latencyMs: output.latencyMs, finishedAt }).where(and(eq(agentComparisonResults.id, row.id), eq(agentComparisonResults.workspaceId, input.workspaceId)));
      return true;
    } catch {
      await db.update(agentComparisonResults).set({ status: 'error', errorCode: 'COMPARISON_PROVIDER_FAILED', finishedAt: new Date().toISOString() }).where(and(eq(agentComparisonResults.id, row.id), eq(agentComparisonResults.workspaceId, input.workspaceId)));
      return false;
    }
  }));
  const successes = outcomes.filter(Boolean).length;
  const status = successes === providers.length ? 'success' : successes ? 'partial' : 'error';
  await db.update(agentComparisonRuns).set({ status, finishedAt: new Date().toISOString() }).where(and(eq(agentComparisonRuns.id, comparisonId), eq(agentComparisonRuns.workspaceId, input.workspaceId)));
  return { comparisonId, status, successes, providerCount: providers.length };
}

export async function listAgentComparisons(workspaceId: string, limit = 20) {
  return getDb().select().from(agentComparisonRuns).where(eq(agentComparisonRuns.workspaceId, workspaceId)).orderBy(desc(agentComparisonRuns.createdAt)).limit(limit);
}
