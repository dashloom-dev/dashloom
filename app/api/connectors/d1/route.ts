import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { connectorAccounts, productConnectorMappings, products } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { encryptSecret } from '@/lib/crypto';
import { discoverD1BusinessData, validateD1Credentials, validateReadOnlyQuery } from '@/lib/d1-connector';
import { validateGuidedMappings } from '@/lib/business-data-discovery';
import { buildGuidedD1Configuration } from '@/lib/d1-query';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const input = z.object({
  displayName: z.string().trim().min(2).max(80),
  accountId: z.string().trim().min(20).max(64),
  databaseId: z.string().uuid(),
  apiToken: z.string().trim().min(20).max(500),
  productId: z.string().uuid(),
  sql: z.string().trim().min(10).max(8000).optional(),
  dateColumn: z.string().trim().min(1).max(80).optional(),
  metrics: z.record(z.string(), z.string()).optional(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional().default('USD'),
  guidedMappings: z.array(z.object({
    metric: z.enum(['revenue', 'orders', 'signups', 'active_subscriptions']),
    resource: z.string().trim().min(1).max(128),
    valueColumn: z.string().trim().min(1).max(128),
    dateColumn: z.string().trim().min(1).max(128).optional(),
    filterColumn: z.string().trim().min(1).max(128).optional(),
    filterValues: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
    scale: z.number().optional(),
    confidence: z.enum(['high', 'medium', 'low']),
    reason: z.string().trim().min(3).max(260),
  })).min(1).max(4).optional(),
});

export async function POST(request: Request) {
  const authSession = await createAuth().api.getSession({ headers: request.headers });
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(authSession.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin'].includes(workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid D1 connection' }, { status: 400 });
  const [product] = await getDb().select({ id: products.id }).from(products).where(and(eq(products.id, parsed.data.productId), eq(products.workspaceId, workspace.id))).limit(1);
  if (!product) return NextResponse.json({ error: 'Product not found in this workspace' }, { status: 404 });
  let configuration;
  try {
    const credentials = { accountId: parsed.data.accountId, databaseId: parsed.data.databaseId, apiToken: parsed.data.apiToken };
    if (parsed.data.guidedMappings?.length) {
      const discovery = await discoverD1BusinessData(credentials);
      configuration = buildGuidedD1Configuration(validateGuidedMappings(discovery.resources, parsed.data.guidedMappings), parsed.data.currency);
    } else {
      if (!parsed.data.sql || !parsed.data.dateColumn || !parsed.data.metrics) throw new Error('Complete guided discovery or provide the advanced SQL mapping.');
      configuration = validateReadOnlyQuery({ sql: parsed.data.sql, dateColumn: parsed.data.dateColumn, metrics: parsed.data.metrics });
      await validateD1Credentials(credentials);
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'D1 validation failed' }, { status: 422 });
  }
  const externalAccountId = `${parsed.data.accountId}:${parsed.data.databaseId}`;
  const [existing] = await getDb().select().from(connectorAccounts).where(and(eq(connectorAccounts.workspaceId, workspace.id), eq(connectorAccounts.provider, 'd1'), eq(connectorAccounts.externalAccountId, externalAccountId))).limit(1);
  const connectorId = existing?.id || crypto.randomUUID();
  const encryptedCredentials = await encryptSecret(JSON.stringify({ accountId: parsed.data.accountId, databaseId: parsed.data.databaseId, apiToken: parsed.data.apiToken }), `connector:${workspace.id}:${connectorId}`);
  if (existing) await getDb().update(connectorAccounts).set({ displayName: parsed.data.displayName, encryptedCredentials, status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(connectorAccounts.id, connectorId));
  else await getDb().insert(connectorAccounts).values({ id: connectorId, workspaceId: workspace.id, provider: 'd1', externalAccountId, displayName: parsed.data.displayName, encryptedCredentials, status: 'connected', lastCheckedAt: new Date().toISOString() });
  await getDb().delete(productConnectorMappings).where(and(eq(productConnectorMappings.workspaceId, workspace.id), eq(productConnectorMappings.productId, product.id), eq(productConnectorMappings.source, 'd1')));
  await getDb().insert(productConnectorMappings).values({ id: crypto.randomUUID(), workspaceId: workspace.id, productId: product.id, connectorAccountId: connectorId, source: 'd1', resourceId: parsed.data.databaseId, resourceLabel: parsed.data.displayName, configurationJson: JSON.stringify(configuration), enabled: true });
  return NextResponse.json({ connector: { id: connectorId, displayName: parsed.data.displayName, databaseId: parsed.data.databaseId, status: 'connected' }, mapping: { productId: product.id, metrics: configuration.metrics } }, { status: 201 });
}
