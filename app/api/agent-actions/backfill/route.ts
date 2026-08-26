import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { analysisRuns } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { agentResultSchema, type AgentResult } from '@/lib/agent';
import { validateAgentCitations } from '@/lib/agent-validation';
import { materializeAgentActions } from '@/lib/agent-actions';
import { recordAuditEvent } from '@/lib/audit';

export async function POST(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers }); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(session.user.id); if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin', 'member'].includes(workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 });
  const runs = await getDb().select({ id: analysisRuns.id, evidenceJson: analysisRuns.evidenceJson, findingsJson: analysisRuns.findingsJson, finishedAt: analysisRuns.finishedAt, createdAt: analysisRuns.createdAt }).from(analysisRuns).where(and(eq(analysisRuns.workspaceId, workspace.id), eq(analysisRuns.status, 'success'), isNotNull(analysisRuns.findingsJson), isNull(analysisRuns.actionsMaterializedAt))).orderBy(asc(analysisRuns.createdAt)).limit(100);
  let imported = 0; let incompatible = 0; let failed = 0;
  for (const run of runs) {
    let findings: AgentResult;
    try {
      const evidence = JSON.parse(run.evidenceJson);
      findings = validateAgentCitations(agentResultSchema.parse(JSON.parse(run.findingsJson!)), evidence);
    } catch {
      incompatible += 1;
      await getDb().update(analysisRuns).set({ actionsMaterializedAt: new Date().toISOString(), actionsErrorCode: 'BACKFILL_INCOMPATIBLE' }).where(and(eq(analysisRuns.id, run.id), eq(analysisRuns.workspaceId, workspace.id)));
      continue;
    }
    try {
      await materializeAgentActions(workspace.id, run.id, findings, run.finishedAt || run.createdAt);
      await getDb().update(analysisRuns).set({ actionsMaterializedAt: new Date().toISOString(), actionsErrorCode: null }).where(and(eq(analysisRuns.id, run.id), eq(analysisRuns.workspaceId, workspace.id)));
      imported += findings.findings.length;
    } catch {
      failed += 1;
      await getDb().update(analysisRuns).set({ actionsErrorCode: 'ACTION_MATERIALIZATION_FAILED' }).where(and(eq(analysisRuns.id, run.id), eq(analysisRuns.workspaceId, workspace.id)));
    }
  }
  await recordAuditEvent({ workspaceId: workspace.id, actorUserId: session.user.id, action: 'agent_actions.backfilled', targetType: 'workspace', targetId: workspace.id, metadata: { runs: runs.length, imported, incompatible, failed } });
  return NextResponse.json({ runs: runs.length, imported, incompatible, failed });
}
