import { getDb } from '@/db';
import { auditEvents } from '@/db/schema';

export async function recordAuditEvent(input: { workspaceId: string; actorUserId?: string | null; action: string; targetType: string; targetId?: string | null; metadata?: Record<string, unknown> }) {
  await getDb().insert(auditEvents).values({ workspaceId: input.workspaceId, actorUserId: input.actorUserId || null, action: input.action, targetType: input.targetType, targetId: input.targetId || null, metadataJson: JSON.stringify(input.metadata || {}) });
}

export async function hashInvitationToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
