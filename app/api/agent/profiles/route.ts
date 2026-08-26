import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { agentProfiles } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { agentDefinitions, type AgentPreset } from '@/lib/agent-catalog';
import { agentPlaybookSchema, defaultAgentPlaybook, parseAgentPlaybook, serializeAgentPlaybook } from '@/lib/agent-playbook';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const presetSchema = z.enum(['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst']);
const input = z.object({ preset: presetSchema, playbook: agentPlaybookSchema }).strict();
const presets = Object.keys(agentDefinitions) as AgentPreset[];

async function context(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return null;
  const workspace = await getPrimaryWorkspace(session.user.id);
  return workspace ? { session, workspace } : null;
}

export async function GET(request: Request) {
  const value = await context(request);
  if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await getDb().select().from(agentProfiles).where(eq(agentProfiles.workspaceId, value.workspace.id));
  return NextResponse.json({ profiles: presets.map((preset) => { const row = rows.find((item) => item.preset === preset); return { id: row?.id || null, preset, name: row?.name || agentDefinitions[preset].name, enabled: row?.enabled ?? true, playbook: row ? parseAgentPlaybook(row.instructionsJson, preset) : defaultAgentPlaybook(preset), configured: Boolean(row) }; }) });
}

export async function PUT(request: Request) {
  const value = await context(request);
  if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(value.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid Agent playbook' }, { status: 400 });
  const db = getDb();
  const [existing] = await db.select({ id: agentProfiles.id }).from(agentProfiles).where(and(eq(agentProfiles.workspaceId, value.workspace.id), eq(agentProfiles.preset, parsed.data.preset))).limit(1);
  const instructionsJson = serializeAgentPlaybook(parsed.data.playbook);
  const id = existing?.id || crypto.randomUUID();
  if (existing) await db.update(agentProfiles).set({ instructionsJson, updatedAt: new Date().toISOString() }).where(and(eq(agentProfiles.id, existing.id), eq(agentProfiles.workspaceId, value.workspace.id)));
  else await db.insert(agentProfiles).values({ id, workspaceId: value.workspace.id, preset: parsed.data.preset, name: agentDefinitions[parsed.data.preset].name, instructionsJson, enabled: true });
  await recordAuditEvent({ workspaceId: value.workspace.id, actorUserId: value.session.user.id, action: 'agent_playbook.updated', targetType: 'agent_profile', targetId: id, metadata: { preset: parsed.data.preset, businessModel: parsed.data.playbook.businessModel, priorities: parsed.data.playbook.priorities, changeSensitivity: parsed.data.playbook.changeSensitivity, responseStyle: parsed.data.playbook.responseStyle, language: parsed.data.playbook.language } });
  return NextResponse.json({ profile: { id, preset: parsed.data.preset, playbook: parsed.data.playbook } });
}
