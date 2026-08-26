import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { connectorAccounts, productConnectorMappings } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(session.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin'].includes(workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid connector account ID is required' }, { status: 400 });
  const db = getDb();
  const [account] = await db.select({ id: connectorAccounts.id, provider: connectorAccounts.provider, status: connectorAccounts.status }).from(connectorAccounts).where(and(eq(connectorAccounts.id, id), eq(connectorAccounts.workspaceId, workspace.id))).limit(1);
  if (!account) return NextResponse.json({ error: 'Connector account not found' }, { status: 404 });
  if (account.status !== 'disabled') {
    await db.update(connectorAccounts).set({ status: 'disabled', encryptedCredentials: null, updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, id), eq(connectorAccounts.workspaceId, workspace.id)));
    const disabledMappings = await db.update(productConnectorMappings).set({ enabled: false, updatedAt: new Date().toISOString() }).where(and(eq(productConnectorMappings.connectorAccountId, id), eq(productConnectorMappings.workspaceId, workspace.id))).returning({ id: productConnectorMappings.id });
    await recordAuditEvent({ workspaceId: workspace.id, actorUserId: session.user.id, action: 'connector.disconnected', targetType: 'connector', targetId: id, metadata: { provider: account.provider, credentialRemoved: true, disabledMappingCount: disabledMappings.length } });
    return NextResponse.json({ disconnected: true, credentialRemoved: true, disabledMappingCount: disabledMappings.length });
  }
  return NextResponse.json({ disconnected: true, credentialRemoved: true, disabledMappingCount: 0, replayed: true });
}
