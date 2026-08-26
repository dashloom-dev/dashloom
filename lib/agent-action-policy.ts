export type AgentActionStatus = 'suggested' | 'planned' | 'in_progress' | 'done' | 'dismissed';

export const allowedAgentActionTransitions: Record<AgentActionStatus, readonly AgentActionStatus[]> = {
  suggested: ['planned', 'dismissed'],
  planned: ['in_progress', 'done', 'dismissed'],
  in_progress: ['planned', 'done', 'dismissed'],
  done: ['in_progress'],
  dismissed: ['planned'],
};

export function canTransitionAgentAction(from: AgentActionStatus, to: AgentActionStatus) { return from === to || allowedAgentActionTransitions[from].includes(to); }

export function agentActionStatusAfterRecurrence(status: AgentActionStatus): AgentActionStatus {
  return status === 'done' ? 'suggested' : status;
}

export function normalizedActionIdentity(input: { productId: string | null; title: string; action: string }) {
  return [input.productId || 'workspace', input.title, input.action].map((value) => value.trim().toLowerCase().replace(/\s+/g, ' ')).join('|');
}

export async function agentActionFingerprint(input: { productId: string | null; title: string; action: string }) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedActionIdentity(input)));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
