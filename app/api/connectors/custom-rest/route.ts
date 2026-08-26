import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { connectorAccounts, productConnectorMappings, products } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { createAuth } from '@/lib/auth';
import { encryptSecret } from '@/lib/crypto';
import { fetchCustomRestMetrics } from '@/lib/custom-rest-client';
import { validateCustomRestConfiguration } from '@/lib/custom-rest-contract';
import { hashToken } from '@/lib/tokens';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const input = z.object({
  displayName: z.string().trim().min(2).max(80),
  productId: z.string().uuid(),
  endpointUrl: z.string().url().max(1000),
  authType: z.enum(['none', 'bearer', 'api_key']),
  secret: z.string().max(2000).optional().default(''),
  headerName: z.string().max(64).optional().default(''),
});

export async function POST(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(session.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin'].includes(workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid Custom REST connection' }, { status: 400 });
  const [product] = await getDb().select({ id: products.id }).from(products).where(and(eq(products.id, parsed.data.productId), eq(products.workspaceId, workspace.id))).limit(1);
  if (!product) return NextResponse.json({ error: 'Product not found in this workspace' }, { status: 404 });
  let endpointUrl: string; let preview: Awaited<ReturnType<typeof fetchCustomRestMetrics>>;
  try {
    endpointUrl = validateCustomRestConfiguration(parsed.data.endpointUrl, parsed.data);
    preview = await fetchCustomRestMetrics({ endpointUrl, authType: parsed.data.authType, headerName: parsed.data.headerName || undefined }, parsed.data.secret || undefined);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Custom REST validation failed' }, { status: 422 }); }
  const externalAccountId = await hashToken(`${endpointUrl}\n${parsed.data.authType}\n${parsed.data.headerName || ''}`); const db = getDb();
  const [existing] = await db.select().from(connectorAccounts).where(and(eq(connectorAccounts.workspaceId, workspace.id), eq(connectorAccounts.provider, 'custom'), eq(connectorAccounts.externalAccountId, externalAccountId))).limit(1);
  const connectorId = existing?.id || crypto.randomUUID();
  const encryptedCredentials = parsed.data.authType === 'none' ? null : await encryptSecret(JSON.stringify({ secret: parsed.data.secret }), `connector:${workspace.id}:${connectorId}`);
  if (existing) await db.update(connectorAccounts).set({ displayName: parsed.data.displayName, encryptedCredentials, status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, connectorId), eq(connectorAccounts.workspaceId, workspace.id)));
  else await db.insert(connectorAccounts).values({ id: connectorId, workspaceId: workspace.id, provider: 'custom', externalAccountId, displayName: parsed.data.displayName, encryptedCredentials, status: 'connected', lastCheckedAt: new Date().toISOString() });
  const endpoint = new URL(endpointUrl); const mappingConfiguration = JSON.stringify({ endpointUrl, authType: parsed.data.authType, ...(parsed.data.authType === 'api_key' ? { headerName: parsed.data.headerName } : {}) });
  await db.insert(productConnectorMappings).values({ id: crypto.randomUUID(), workspaceId: workspace.id, productId: product.id, connectorAccountId: connectorId, source: 'custom', resourceId: externalAccountId, resourceLabel: `${endpoint.hostname}${endpoint.pathname}`, configurationJson: mappingConfiguration, enabled: true }).onConflictDoUpdate({ target: [productConnectorMappings.productId, productConnectorMappings.source, productConnectorMappings.resourceId], set: { connectorAccountId: connectorId, resourceLabel: `${endpoint.hostname}${endpoint.pathname}`, configurationJson: mappingConfiguration, enabled: true, updatedAt: new Date().toISOString() } });
  await recordAuditEvent({ workspaceId: workspace.id, actorUserId: session.user.id, action: 'connector.custom_rest_connected', targetType: 'connector', targetId: connectorId, metadata: { productId: product.id, endpointOrigin: endpoint.origin, authType: parsed.data.authType, metricCount: preview.metrics.length } });
  return NextResponse.json({ connector: { id: connectorId, displayName: parsed.data.displayName, endpoint: `${endpoint.hostname}${endpoint.pathname}`, metricCount: preview.metrics.length, status: 'connected' } }, { status: 201 });
}
