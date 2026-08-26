import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { aiProviderAccounts } from '@/db/schema';
import { agentDefinitions, type AgentPreset } from '@/lib/agent-catalog';
import { getWorkspaceAgentReadiness } from '@/lib/agent-readiness';

export async function getAgentExecutionAvailability(workspaceId: string, preset: AgentPreset, productId?: string | null) {
  const [readiness, [connectedProvider]] = await Promise.all([
    getWorkspaceAgentReadiness(workspaceId, productId),
    getDb().select({ id: aiProviderAccounts.id }).from(aiProviderAccounts).where(and(eq(aiProviderAccounts.workspaceId, workspaceId), eq(aiProviderAccounts.status, 'connected'))).limit(1),
  ]);
  if (!readiness[preset].ready) return { ready: false as const, code: 'EVIDENCE_UNAVAILABLE' as const, message: `${agentDefinitions[preset].name} needs matching recent evidence.` };
  if (!connectedProvider) return { ready: false as const, code: 'MODEL_UNAVAILABLE' as const, message: 'Connect a BYOK model.' };
  return { ready: true as const, code: null, message: 'Agent execution is available.' };
}
