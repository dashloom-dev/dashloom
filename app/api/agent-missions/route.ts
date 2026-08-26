import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { agentGrowthMissions, workspaceMembers } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { createAgentGrowthMission } from '@/lib/agent-growth-missions';
import { recordAuditEvent } from '@/lib/audit';

const createInput = z.object({
  actionId: z.string().uuid(),
  title: z.string().trim().min(2).max(160).optional(),
  hypothesis: z.string().trim().min(10).max(700),
  targetDirection: z.enum(['increase', 'decrease']),
  targetChangePercent: z.number().positive().max(10000),
  dueAt: z.iso.datetime(),
  assignedUserId: z.string().min(1).nullable().default(null),
}).superRefine((value, context) => {
  if (value.targetDirection === 'decrease' && value.targetChangePercent > 100) context.addIssue({ code: 'custom', path: ['targetChangePercent'], message: 'A decrease target cannot exceed 100 percent.' });
});
const updateInput = z.object({ id: z.string().uuid(), status: z.literal('cancelled') });

async function missionSession(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const workspace = await getPrimaryWorkspace(session.user.id);
  if (!workspace) return { error: NextResponse.json({ error: 'Workspace not found' }, { status: 404 }) };
  if (!['owner', 'admin', 'member'].includes(workspace.role)) return { error: NextResponse.json({ error: 'Member access required' }, { status: 403 }) };
  return { session, workspace };
}

export async function POST(request: Request) {
  const access = await missionSession(request); if ('error' in access) return access.error;
  const parsed = createInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid growth mission' }, { status: 400 });
  if (parsed.data.assignedUserId) {
    const [member] = await getDb().select({ id: workspaceMembers.userId }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, access.workspace.id), eq(workspaceMembers.userId, parsed.data.assignedUserId))).limit(1);
    if (!member) return NextResponse.json({ error: 'Assignee is not a member of this workspace.' }, { status: 400 });
  }
  try {
    const mission = await createAgentGrowthMission({ ...parsed.data, workspaceId: access.workspace.id, createdByUserId: access.session.user.id });
    await recordAuditEvent({ workspaceId: access.workspace.id, actorUserId: access.session.user.id, action: 'agent_growth_mission.created', targetType: 'agent_growth_mission', targetId: mission.id, metadata: { sourceActionId: mission.sourceActionId, metric: mission.metric, dueAt: mission.dueAt } });
    return NextResponse.json({ mission }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Growth mission could not be created.';
    const status = /already has/.test(message) ? 409 : /not found/.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  const access = await missionSession(request); if ('error' in access) return access.error;
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid mission update' }, { status: 400 });
  const now = new Date().toISOString();
  const updated = await getDb().update(agentGrowthMissions).set({ status: 'cancelled', assessment: 'cancelled', finishedAt: now, updatedAt: now }).where(and(eq(agentGrowthMissions.id, parsed.data.id), eq(agentGrowthMissions.workspaceId, access.workspace.id), eq(agentGrowthMissions.status, 'active'))).returning({ id: agentGrowthMissions.id });
  if (!updated.length) return NextResponse.json({ error: 'Active growth mission not found or it changed in another session.' }, { status: 409 });
  await recordAuditEvent({ workspaceId: access.workspace.id, actorUserId: access.session.user.id, action: 'agent_growth_mission.cancelled', targetType: 'agent_growth_mission', targetId: parsed.data.id });
  return NextResponse.json({ mission: { id: parsed.data.id, status: 'cancelled' } });
}
