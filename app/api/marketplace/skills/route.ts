import { NextResponse } from 'next/server';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { findMarketplaceSkill } from '@/lib/extension-marketplace';
import { AgentSkillInstallError, installAgentSkill } from '@/lib/agent-skill-installation';

export async function POST(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(session.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin'].includes(workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const body = await request.json().catch(() => null) as { slug?: unknown } | null;
  if (!body || typeof body.slug !== 'string') return NextResponse.json({ error: 'Published skill slug is required' }, { status: 400 });
  const item = findMarketplaceSkill(body.slug);
  if (!item) return NextResponse.json({ error: 'Published skill not found' }, { status: 404 });
  try {
    const result = await installAgentSkill({ workspaceId: workspace.id, actorUserId: session.user.id, manifest: item.manifest, provenance: { channel: 'marketplace', publisher: item.publisher, sourceUrl: item.sourceUrl, reviewStatus: item.review.status, reviewedAt: item.review.reviewedAt } });
    return NextResponse.json({ skill: result.skill, validation: result.validation, unchanged: result.unchanged }, { status: result.httpStatus });
  } catch (error) {
    if (error instanceof AgentSkillInstallError) return NextResponse.json({ error: error.message, validation: error.validation }, { status: error.status });
    throw error;
  }
}
