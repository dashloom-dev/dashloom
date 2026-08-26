import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentSkillManifests } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { AGENT_SKILL_POLICY_VERSION, agentSkillInstructionHash, compareSemanticVersions, validateAgentSkillPolicy, type AgentSkillManifest } from '@/lib/agent-skill-validation';

export class AgentSkillInstallError extends Error {
  constructor(message: string, public status: number, public validation?: Record<string, unknown>) { super(message); }
}

export async function installAgentSkill(input: { workspaceId: string; actorUserId: string; manifest: AgentSkillManifest; provenance?: { channel: 'manual' | 'marketplace'; publisher?: string; sourceUrl?: string; reviewStatus?: string; reviewedAt?: string } }) {
  const policyIssues = validateAgentSkillPolicy(input.manifest);
  if (policyIssues.length) throw new AgentSkillInstallError(policyIssues[0].message, 400, { policyVersion: AGENT_SKILL_POLICY_VERSION, passed: false, issues: policyIssues });

  const db = getDb();
  const [existing] = await db.select().from(agentSkillManifests).where(and(eq(agentSkillManifests.workspaceId, input.workspaceId), eq(agentSkillManifests.slug, input.manifest.slug))).limit(1);
  const requiredMetricsJson = JSON.stringify(input.manifest.requiredMetrics);
  const unchanged = existing && existing.version === input.manifest.version && existing.name === input.manifest.name && existing.basePreset === input.manifest.basePreset && existing.instructions === input.manifest.instructions && existing.requiredMetricsJson === requiredMetricsJson;
  if (existing && !unchanged && compareSemanticVersions(input.manifest.version, existing.version) <= 0) throw new AgentSkillInstallError(`Skill updates must increase the semantic version above ${existing.version}.`, 409);

  const instructionHash = await agentSkillInstructionHash(input.manifest.instructions);
  const provenance = input.provenance || { channel: 'manual' as const };
  if (unchanged) {
    if (!existing.enabled) {
      await db.update(agentSkillManifests).set({ enabled: true, updatedAt: new Date().toISOString(), createdByUserId: input.actorUserId }).where(and(eq(agentSkillManifests.id, existing.id), eq(agentSkillManifests.workspaceId, input.workspaceId)));
      await recordAuditEvent({ workspaceId: input.workspaceId, actorUserId: input.actorUserId, action: 'agent_skill.reenabled', targetType: 'agent_skill', targetId: existing.slug, metadata: { version: existing.version, instructionHash, policyVersion: AGENT_SKILL_POLICY_VERSION, provenance } });
    }
    return { httpStatus: 200, skill: { id: existing.id, slug: existing.slug, version: existing.version }, validation: { policyVersion: AGENT_SKILL_POLICY_VERSION, passed: true, instructionHash }, unchanged: true };
  }

  const id = existing?.id || crypto.randomUUID();
  await db.insert(agentSkillManifests).values({ id, workspaceId: input.workspaceId, ...input.manifest, requiredMetricsJson, createdByUserId: input.actorUserId }).onConflictDoUpdate({ target: [agentSkillManifests.workspaceId, agentSkillManifests.slug], set: { name: input.manifest.name, version: input.manifest.version, basePreset: input.manifest.basePreset, instructions: input.manifest.instructions, requiredMetricsJson, enabled: true, updatedAt: new Date().toISOString(), createdByUserId: input.actorUserId } });
  await recordAuditEvent({ workspaceId: input.workspaceId, actorUserId: input.actorUserId, action: existing ? 'agent_skill.updated' : 'agent_skill.installed', targetType: 'agent_skill', targetId: input.manifest.slug, metadata: { version: input.manifest.version, previousVersion: existing?.version || null, basePreset: input.manifest.basePreset, instructionHash, policyVersion: AGENT_SKILL_POLICY_VERSION, requiredMetricCount: input.manifest.requiredMetrics.length, provenance } });
  return { httpStatus: 201, skill: { id, slug: input.manifest.slug, version: input.manifest.version }, validation: { policyVersion: AGENT_SKILL_POLICY_VERSION, passed: true, instructionHash }, unchanged: false };
}
