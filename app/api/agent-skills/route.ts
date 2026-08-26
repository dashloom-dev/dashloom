import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { agentSkillManifests } from '@/db/schema';
import { agentSkillManifestSchema } from '@/lib/agent-skill-validation';
import { AgentSkillInstallError, installAgentSkill } from '@/lib/agent-skill-installation';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';

async function context(request: Request) { const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return null; const workspace = await getPrimaryWorkspace(session.user.id); return workspace ? { session, workspace } : null; }
export async function GET(request: Request) { const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json({ skills: await getDb().select().from(agentSkillManifests).where(eq(agentSkillManifests.workspaceId, value.workspace.id)).orderBy(agentSkillManifests.name) }); }
export async function POST(request: Request) {
  const value = await context(request);
  if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(value.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = agentSkillManifestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid skill manifest' }, { status: 400 });
  try { const result = await installAgentSkill({ workspaceId: value.workspace.id, actorUserId: value.session.user.id, manifest: parsed.data, provenance: { channel: 'manual' } }); return NextResponse.json({ skill: result.skill, validation: result.validation }, { status: result.httpStatus }); }
  catch (error) { if (error instanceof AgentSkillInstallError) return NextResponse.json({ error: error.message, validation: error.validation }, { status: error.status }); throw error; }
}
export async function DELETE(request: Request) { const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); if (!['owner', 'admin'].includes(value.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 }); const id = new URL(request.url).searchParams.get('id'); if (!id) return NextResponse.json({ error: 'Skill id is required' }, { status: 400 }); const result = await getDb().update(agentSkillManifests).set({ enabled: false, updatedAt: new Date().toISOString() }).where(and(eq(agentSkillManifests.id, id), eq(agentSkillManifests.workspaceId, value.workspace.id))); if (!result.meta.changes) return NextResponse.json({ error: 'Skill not found' }, { status: 404 }); return NextResponse.json({ disabled: true }); }
