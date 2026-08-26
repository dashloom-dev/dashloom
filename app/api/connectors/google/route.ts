import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { connectorAccounts, connectorResources, productConnectorMappings, products } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const mappingInput = z.object({ productId: z.string().uuid(), connectorAccountId: z.string().uuid(), source: z.enum(['ga4', 'gsc']), resourceId: z.string().min(1).max(500) });

async function current(request: Request) {
  const authSession = await createAuth().api.getSession({ headers: request.headers });
  if (!authSession) return null;
  const workspace = await getPrimaryWorkspace(authSession.user.id);
  return workspace ? { authSession, workspace } : null;
}

export async function GET(request: Request) {
  const context = await current(request);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [accounts, resources, mappings] = await Promise.all([
    getDb().select({ id: connectorAccounts.id, displayName: connectorAccounts.displayName, status: connectorAccounts.status, lastCheckedAt: connectorAccounts.lastCheckedAt }).from(connectorAccounts).where(and(eq(connectorAccounts.workspaceId, context.workspace.id), eq(connectorAccounts.provider, 'google'))),
    getDb().select().from(connectorResources).where(eq(connectorResources.workspaceId, context.workspace.id)),
    getDb().select().from(productConnectorMappings).where(and(eq(productConnectorMappings.workspaceId, context.workspace.id), eq(productConnectorMappings.enabled, true))),
  ]);
  return NextResponse.json({ accounts, resources: resources.map((resource) => ({ ...resource, domains: JSON.parse(resource.domainsJson), domainsJson: undefined })), mappings: mappings.filter((mapping) => mapping.source === 'ga4' || mapping.source === 'gsc') });
}

export async function POST(request: Request) {
  const context = await current(request);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(context.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = mappingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid mapping' }, { status: 400 });
  const [product, resource] = await Promise.all([
    getDb().select({ id: products.id }).from(products).where(and(eq(products.workspaceId, context.workspace.id), eq(products.id, parsed.data.productId))).limit(1),
    getDb().select().from(connectorResources).where(and(eq(connectorResources.workspaceId, context.workspace.id), eq(connectorResources.connectorAccountId, parsed.data.connectorAccountId), eq(connectorResources.type, parsed.data.source), eq(connectorResources.resourceId, parsed.data.resourceId))).limit(1),
  ]);
  if (!product.length || !resource.length) return NextResponse.json({ error: 'Product or Google resource not found' }, { status: 404 });
  await getDb().delete(productConnectorMappings).where(and(eq(productConnectorMappings.workspaceId, context.workspace.id), eq(productConnectorMappings.productId, parsed.data.productId), eq(productConnectorMappings.source, parsed.data.source)));
  await getDb().insert(productConnectorMappings).values({ id: crypto.randomUUID(), workspaceId: context.workspace.id, productId: parsed.data.productId, connectorAccountId: parsed.data.connectorAccountId, source: parsed.data.source, resourceId: parsed.data.resourceId, resourceLabel: resource[0].displayName, enabled: true });
  return NextResponse.json({ mapping: { ...parsed.data, resourceLabel: resource[0].displayName } }, { status: 201 });
}
