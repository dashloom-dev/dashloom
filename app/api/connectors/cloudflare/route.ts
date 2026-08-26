import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { connectorAccounts, productConnectorMappings, products } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { validateCloudflareCredentials } from '@/lib/cloudflare';
import { encryptSecret } from '@/lib/crypto';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const input = z.object({ displayName: z.string().trim().min(2).max(80), accountId: z.string().trim().min(20).max(64), apiToken: z.string().trim().min(20).max(500), productId: z.string().uuid(), workerName: z.string().trim().min(1).max(120) });

export async function POST(request: Request) {
  const authSession = await createAuth().api.getSession({ headers: request.headers });
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(authSession.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin'].includes(workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid connection' }, { status: 400 });
  const [product] = await getDb().select({ id: products.id }).from(products).where(and(eq(products.id, parsed.data.productId), eq(products.workspaceId, workspace.id))).limit(1);
  if (!product) return NextResponse.json({ error: 'Product not found in this workspace' }, { status: 404 });
  try { await validateCloudflareCredentials({ accountId: parsed.data.accountId, apiToken: parsed.data.apiToken }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Cloudflare validation failed' }, { status: 422 }); }
  const [existing] = await getDb().select().from(connectorAccounts).where(and(eq(connectorAccounts.workspaceId, workspace.id), eq(connectorAccounts.provider, 'cloudflare'), eq(connectorAccounts.externalAccountId, parsed.data.accountId))).limit(1);
  const connectorId = existing?.id || crypto.randomUUID();
  const encryptedCredentials = await encryptSecret(JSON.stringify({ accountId: parsed.data.accountId, apiToken: parsed.data.apiToken }), `connector:${workspace.id}:${connectorId}`);
  if (existing) await getDb().update(connectorAccounts).set({ displayName: parsed.data.displayName, encryptedCredentials, status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(connectorAccounts.id, connectorId));
  else await getDb().insert(connectorAccounts).values({ id: connectorId, workspaceId: workspace.id, provider: 'cloudflare', externalAccountId: parsed.data.accountId, displayName: parsed.data.displayName, encryptedCredentials, status: 'connected', lastCheckedAt: new Date().toISOString() });
  await getDb().delete(productConnectorMappings).where(and(eq(productConnectorMappings.workspaceId, workspace.id), eq(productConnectorMappings.productId, product.id), eq(productConnectorMappings.source, 'cloudflare')));
  await getDb().insert(productConnectorMappings).values({ id: crypto.randomUUID(), workspaceId: workspace.id, productId: product.id, connectorAccountId: connectorId, source: 'cloudflare', resourceId: parsed.data.workerName, resourceLabel: parsed.data.workerName, enabled: true });
  return NextResponse.json({ connector: { id: connectorId, displayName: parsed.data.displayName, accountId: parsed.data.accountId, status: 'connected' }, mapping: { productId: product.id, workerName: parsed.data.workerName } }, { status: 201 });
}
