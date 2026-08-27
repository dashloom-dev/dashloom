import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { products, reportSchedules } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { getWorkspaceEntitlements } from '@/lib/entitlements';
import { nextScheduleRun } from '@/lib/schedules';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { recordAuditEvent } from '@/lib/audit';
import { getAgentExecutionAvailability } from '@/lib/agent-availability';
import { executiveBriefPreflight } from '@/lib/executive-brief-runner';
import type { AgentPreset } from '@/lib/agent-catalog';
import { parseExecutiveSchedulePresets } from '@/lib/executive-report';
import { normalizeAgentProductScope, resolveAgentProductScope } from '@/lib/agent-scope';

const preset = z.enum(['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst']);
const input = z.object({ name: z.string().trim().min(2).max(80), kind: z.enum(['specialist', 'executive']).default('specialist'), cadence: z.enum(['daily', 'weekly', 'monthly']), agentPreset: preset.optional(), executivePresets: z.array(preset).max(5).default([]), executiveQuestion: z.string().trim().min(3).max(1000).optional(), productId: z.string().uuid().nullable().optional(), timezone: z.string().trim().min(1).max(80), hourLocal: z.number().int().min(0).max(23), dayOfWeek: z.number().int().min(0).max(6).nullable().optional(), dayOfMonth: z.number().int().min(1).max(31).nullable().optional() }).superRefine((value, context) => {
  if (value.kind === 'specialist' && !value.agentPreset) context.addIssue({ code: 'custom', path: ['agentPreset'], message: 'Choose a specialist.' });
  if (value.kind === 'executive' && new Set(value.executivePresets).size < 2) context.addIssue({ code: 'custom', path: ['executivePresets'], message: 'Choose at least two unique specialists.' });
  if (value.kind === 'executive' && !value.executiveQuestion) context.addIssue({ code: 'custom', path: ['executiveQuestion'], message: 'Add an Executive Brief question.' });
});
const lifecycleInput = z.object({ id: z.string().uuid(), enabled: z.boolean() });

async function context(request: Request) { const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return null; const workspace = await getPrimaryWorkspace(session.user.id); return workspace ? { session, workspace } : null; }

export async function GET(request: Request) { const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json({ schedules: await getDb().select().from(reportSchedules).where(eq(reportSchedules.workspaceId, value.workspace.id)) }); }

export async function POST(request: Request) {
  const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(value.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid schedule' }, { status: 400 });
  try { new Intl.DateTimeFormat('en-US', { timeZone: parsed.data.timezone }).format(); } catch { return NextResponse.json({ error: 'Invalid IANA timezone.' }, { status: 400 }); }
  const scope = resolveAgentProductScope(parsed.data.productId);
  if (scope.productId) { const [product] = await getDb().select({ id: products.id }).from(products).where(and(eq(products.id, scope.productId), eq(products.workspaceId, value.workspace.id))).limit(1); if (!product) return NextResponse.json({ error: 'Product not found in this workspace.' }, { status: 404 }); }
  if (parsed.data.kind === 'executive') {
    try { await executiveBriefPreflight(value.workspace.id, parsed.data.executivePresets, 'dailyLimit', scope); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Executive Brief is not ready.' }, { status: 422 }); }
  } else {
    const availability = await getAgentExecutionAvailability(value.workspace.id, parsed.data.agentPreset as AgentPreset, scope.productId); if (!availability.ready) return NextResponse.json({ error: availability.message }, { status: 422 });
  }
  const [total] = await getDb().select({ value: count() }).from(reportSchedules).where(eq(reportSchedules.workspaceId, value.workspace.id)); const entitlements = await getWorkspaceEntitlements(value.workspace.id);
  if (Number(total?.value || 0) >= entitlements.scheduledReports) return NextResponse.json({ error: `The ${entitlements.plan} plan allows ${entitlements.scheduledReports} report schedules.` }, { status: 403 });
  const id = crypto.randomUUID(); const nextRunAt = nextScheduleRun(parsed.data);
  await getDb().insert(reportSchedules).values({ id, workspaceId: value.workspace.id, scopeMode: scope.mode, productId: scope.productId, name: parsed.data.name, kind: parsed.data.kind, cadence: parsed.data.cadence, agentPreset: parsed.data.agentPreset || 'portfolio_analyst', executivePresetsJson: JSON.stringify(parsed.data.kind === 'executive' ? parsed.data.executivePresets : []), executiveQuestion: parsed.data.kind === 'executive' ? parsed.data.executiveQuestion : null, createdByUserId: value.session.user.id, timezone: parsed.data.timezone, hourLocal: parsed.data.hourLocal, dayOfWeek: parsed.data.dayOfWeek, dayOfMonth: parsed.data.dayOfMonth, channelIdsJson: '[]', nextRunAt, enabled: true });
  await recordAuditEvent({ workspaceId: value.workspace.id, actorUserId: value.session.user.id, action: 'report_schedule.created', targetType: 'report_schedule', targetId: id, metadata: { kind: parsed.data.kind, cadence: parsed.data.cadence, scopeMode: scope.mode, productId: scope.productId, specialists: parsed.data.kind === 'executive' ? parsed.data.executivePresets : [parsed.data.agentPreset] } });
  return NextResponse.json({ schedule: { id, ...parsed.data, nextRunAt, enabled: true } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(value.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = lifecycleInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid schedule update' }, { status: 400 });
  const [schedule] = await getDb().select().from(reportSchedules).where(and(eq(reportSchedules.id, parsed.data.id), eq(reportSchedules.workspaceId, value.workspace.id))).limit(1);
  if (!schedule) return NextResponse.json({ error: 'Report schedule not found.' }, { status: 404 });
  if (parsed.data.enabled) {
    const scope = normalizeAgentProductScope({ mode: schedule.scopeMode, productId: schedule.productId });
    if (scope.mode === 'product' && !scope.productId) return NextResponse.json({ error: 'The scheduled product is no longer available.' }, { status: 422 });
    if (schedule.kind === 'executive') {
      let presets: AgentPreset[] = []; try { presets = parseExecutiveSchedulePresets(schedule.executivePresetsJson); } catch { return NextResponse.json({ error: 'Saved Executive Brief specialists are invalid.' }, { status: 422 }); }
      try { await executiveBriefPreflight(value.workspace.id, presets, 'dailyLimit', scope); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Executive Brief is not ready.' }, { status: 422 }); }
    } else {
      const availability = await getAgentExecutionAvailability(value.workspace.id, schedule.agentPreset, scope.productId); if (!availability.ready) return NextResponse.json({ error: availability.message }, { status: 422 });
    }
  }
  const nextRunAt = parsed.data.enabled ? schedule.activeOccurrenceAt ? new Date(Date.now() + 60_000).toISOString() : nextScheduleRun(schedule) : schedule.nextRunAt;
  await getDb().update(reportSchedules).set({ enabled: parsed.data.enabled, nextRunAt, updatedAt: new Date().toISOString() }).where(and(eq(reportSchedules.id, schedule.id), eq(reportSchedules.workspaceId, value.workspace.id)));
  await recordAuditEvent({ workspaceId: value.workspace.id, actorUserId: value.session.user.id, action: parsed.data.enabled ? 'report_schedule.resumed' : 'report_schedule.paused', targetType: 'report_schedule', targetId: schedule.id });
  return NextResponse.json({ schedule: { id: schedule.id, enabled: parsed.data.enabled, nextRunAt } });
}

export async function DELETE(request: Request) {
  const value = await context(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(value.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id'); if (!id || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid schedule ID is required.' }, { status: 400 });
  const result = await getDb().delete(reportSchedules).where(and(eq(reportSchedules.id, id), eq(reportSchedules.workspaceId, value.workspace.id))).returning({ id: reportSchedules.id });
  if (!result.length) return NextResponse.json({ error: 'Report schedule not found.' }, { status: 404 });
  await recordAuditEvent({ workspaceId: value.workspace.id, actorUserId: value.session.user.id, action: 'report_schedule.deleted', targetType: 'report_schedule', targetId: id });
  return NextResponse.json({ deleted: true });
}
