import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { agentActions, workspaceMembers } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { canTransitionAgentAction } from '@/lib/agent-action-policy';
import { recordAuditEvent } from '@/lib/audit';
import { captureAgentActionOutcome } from '@/lib/agent-action-outcomes';

const input = z.object({ id: z.string().uuid(), status: z.enum(['suggested', 'planned', 'in_progress', 'done', 'dismissed']), assignedUserId: z.string().min(1).nullable(), dueAt: z.iso.datetime().nullable(), dismissedReason: z.string().trim().max(500).nullable().default(null) }).superRefine((value, context) => { if (value.status === 'dismissed' && (!value.dismissedReason || value.dismissedReason.length < 2)) context.addIssue({ code: 'custom', message: 'A dismissal reason is required.' }); });

export async function PATCH(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(session.user.id); if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin', 'member'].includes(workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid action update' }, { status: 400 });
  const db = getDb(); const [current] = await db.select().from(agentActions).where(and(eq(agentActions.id, parsed.data.id), eq(agentActions.workspaceId, workspace.id))).limit(1); if (!current) return NextResponse.json({ error: 'Agent action not found' }, { status: 404 });
  if (!canTransitionAgentAction(current.status, parsed.data.status)) return NextResponse.json({ error: `Action cannot move from ${current.status} to ${parsed.data.status}.` }, { status: 409 });
  if (parsed.data.assignedUserId) { const [member] = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, parsed.data.assignedUserId))).limit(1); if (!member) return NextResponse.json({ error: 'Assignee is not a member of this workspace.' }, { status: 400 }); }
  const updatedAt = new Date().toISOString(); const values = { status: parsed.data.status, assignedUserId: parsed.data.assignedUserId, dueAt: parsed.data.dueAt, dismissedReason: parsed.data.status === 'dismissed' ? parsed.data.dismissedReason : null, completedAt: parsed.data.status === 'done' ? updatedAt : null, updatedAt };
  const updated = await db.update(agentActions).set(values).where(and(eq(agentActions.id, current.id), eq(agentActions.workspaceId, workspace.id), eq(agentActions.status, current.status))).returning({ id: agentActions.id }); if (!updated.length) return NextResponse.json({ error: 'Action changed in another session. Refresh and try again.' }, { status: 409 });
  let outcomeStatus: 'not_requested' | 'captured' | 'unavailable' = 'not_requested';
  if (current.status !== 'done' && parsed.data.status === 'done') {
    try { await captureAgentActionOutcome(workspace.id, current.id, updatedAt); outcomeStatus = 'captured'; }
    catch { outcomeStatus = 'unavailable'; }
  }
  await recordAuditEvent({ workspaceId: workspace.id, actorUserId: session.user.id, action: 'agent_action.updated', targetType: 'agent_action', targetId: current.id, metadata: { from: current.status, to: parsed.data.status, assignedUserId: parsed.data.assignedUserId, dueAt: parsed.data.dueAt, outcomeStatus } });
  return NextResponse.json({ action: { id: current.id, ...values }, outcomeStatus, ...(outcomeStatus === 'unavailable' ? { warning: 'Action completed, but the metric baseline could not be captured. Review the linked evidence.' } : {}) });
}
