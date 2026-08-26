import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentActions, products, reports } from '@/db/schema';
import { AgentPreset, agentDefinitions, runWorkspaceAgent } from './agent';
import { comparisonWindow } from './analysis-window';
import { formatAgentActionDigest } from './report-action-digest';
import { runExecutiveBrief } from './executive-brief-runner';
import { formatExecutiveReportSections } from './executive-report';
import { normalizeAgentProductScope, type AgentProductScope } from './agent-scope';

export type ReportCadence = 'daily' | 'weekly' | 'monthly' | 'manual';

function date(offset = 0) { return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10); }

async function resolveReportScope(workspaceId: string, scope: AgentProductScope) {
  scope = normalizeAgentProductScope(scope);
  if (scope.mode === 'workspace') return { scope, label: 'All products' };
  if (!scope.productId) throw new Error('The product used by this report is no longer available.');
  const [product] = await getDb().select({ id: products.id, name: products.name }).from(products).where(and(eq(products.id, scope.productId), eq(products.workspaceId, workspaceId))).limit(1);
  if (!product) throw new Error('The selected product was not found in this workspace.');
  return { scope, label: product.name };
}

export async function generateWorkspaceReport(workspaceId: string, preset: AgentPreset, cadence: ReportCadence, idempotencyKey?: string, requestedScope: AgentProductScope = { mode: 'workspace', productId: null }) {
  const db = getDb();
  if (idempotencyKey) {
    const [existing] = await db.select().from(reports).where(and(eq(reports.workspaceId, workspaceId), eq(reports.idempotencyKey, idempotencyKey))).limit(1);
    if (existing) return existing;
  }
  const { scope, label: scopeLabel } = await resolveReportScope(workspaceId, requestedScope);
  const window = comparisonWindow(cadence);
  const end = date(window.currentEndOffset);
  const start = date(window.splitOffset);
  const analysis = await runWorkspaceAgent(workspaceId, `Prepare a ${cadence} operator report for ${start} through ${end}. Lead with the most important changes, explain business impact, and give prioritized next actions.`, preset, cadence === 'manual' ? 'manual' : cadence, null, scope);
  const [openActions] = await Promise.all([
    db.select({ title: agentActions.title, recommendedAction: agentActions.recommendedAction, severity: agentActions.severity, status: agentActions.status, occurrenceCount: agentActions.occurrenceCount, dueAt: agentActions.dueAt }).from(agentActions).where(and(eq(agentActions.workspaceId, workspaceId), scope.productId ? eq(agentActions.productId, scope.productId) : undefined, inArray(agentActions.status, ['suggested', 'planned', 'in_progress']))).orderBy(sql`case ${agentActions.severity} when 'critical' then 1 when 'warning' then 2 when 'opportunity' then 3 else 4 end`, desc(agentActions.lastSeenAt)).limit(5),
  ]);
  const brandName = 'Dashloom';
  const title = `${brandName} · ${scopeLabel} · ${agentDefinitions[preset].name} ${cadence === 'manual' ? 'brief' : `${cadence} report`} · ${end}`;
  const sections = analysis.findings.findings.map((finding) => `## ${finding.title}\n\n${finding.detail}\n\n**Next action:** ${finding.action}\n\n**Confidence:** ${Math.round(finding.confidence * 100)}%\n\n**Evidence:** ${finding.evidenceRefs.length ? finding.evidenceRefs.join(', ') : 'See frozen analysis evidence'}`).join('\n\n');
  const actionDigest = formatAgentActionDigest(openActions);
  const attribution = `Prepared by ${brandName} Community.`;
  const report = { id: crypto.randomUUID(), workspaceId, scopeMode: scope.mode, productId: scope.productId, analysisRunId: analysis.runId, idempotencyKey: idempotencyKey || null, cadence, periodStart: start, periodEnd: end, title, summary: analysis.findings.summary, contentMarkdown: `# ${title}\n\n**Evidence scope:** ${scopeLabel}\n\n${analysis.findings.summary}\n\n${actionDigest}\n\n${sections}\n\n---\n\n${attribution}`, status: 'ready' as const };
  await db.insert(reports).values(report);
  return { ...report, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export async function generateExecutiveWorkspaceReport(input: { workspaceId: string; createdByUserId: string; presets: AgentPreset[]; question: string; cadence: Exclude<ReportCadence, 'manual'>; idempotencyKey?: string; scope?: AgentProductScope }) {
  const db = getDb();
  if (input.idempotencyKey) {
    const [existing] = await db.select().from(reports).where(and(eq(reports.workspaceId, input.workspaceId), eq(reports.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing) return existing;
  }
  const { scope, label: scopeLabel } = await resolveReportScope(input.workspaceId, input.scope || { mode: 'workspace', productId: null });
  const window = comparisonWindow(input.cadence);
  const end = date(window.currentEndOffset);
  const start = date(window.splitOffset);
  const brief = await runExecutiveBrief({ workspaceId: input.workspaceId, createdByUserId: input.createdByUserId, question: input.question, presets: input.presets, trigger: input.cadence, scope });
  if (!brief.digest) throw new Error('Executive Brief report generation failed.');
  const [openActions] = await Promise.all([
    db.select({ title: agentActions.title, recommendedAction: agentActions.recommendedAction, severity: agentActions.severity, status: agentActions.status, occurrenceCount: agentActions.occurrenceCount, dueAt: agentActions.dueAt }).from(agentActions).where(and(eq(agentActions.workspaceId, input.workspaceId), scope.productId ? eq(agentActions.productId, scope.productId) : undefined, inArray(agentActions.status, ['suggested', 'planned', 'in_progress']))).orderBy(sql`case ${agentActions.severity} when 'critical' then 1 when 'warning' then 2 when 'opportunity' then 3 else 4 end`, desc(agentActions.lastSeenAt)).limit(5),
  ]);
  const brandName = 'Dashloom';
  const title = `${brandName} · ${scopeLabel} · Executive Brief ${input.cadence} report · ${end}`;
  const sections = formatExecutiveReportSections(brief.digest);
  const summary = brief.status === 'partial' ? `${brief.digest.summary} ${brief.failures} selected specialist${brief.failures === 1 ? '' : 's'} failed safely; successful evidence remains available.` : brief.digest.summary;
  const attribution = `Prepared by ${brandName} Community.`;
  const report = { id: crypto.randomUUID(), workspaceId: input.workspaceId, scopeMode: scope.mode, productId: scope.productId, analysisRunId: null, executiveBriefId: brief.id, idempotencyKey: input.idempotencyKey || null, cadence: input.cadence, periodStart: start, periodEnd: end, title, summary, contentMarkdown: `# ${title}\n\n**Evidence scope:** ${scopeLabel}\n\n${summary}\n\n## Specialist status\n\n${sections.specialists}\n\n${formatAgentActionDigest(openActions)}\n\n${sections.priorities}\n\n---\n\n${attribution}`, status: 'ready' as const };
  await db.insert(reports).values(report);
  return { ...report, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
