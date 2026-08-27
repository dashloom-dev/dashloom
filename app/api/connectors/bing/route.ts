import { and, eq, notInArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { connectorAccounts, connectorResources, productConnectorMappings, products } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { createAuth } from '@/lib/auth';
import { normalizeBingDomain, syncBingWorkspace, validateBingApiKey } from '@/lib/bing-webmaster';
import { encryptSecret } from '@/lib/crypto';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const connectionInput = z.object({ displayName: z.string().trim().min(2).max(80), apiKey: z.string().trim().min(16).max(500) });
const mappingInput = z.object({ productId: z.string().uuid(), connectorAccountId: z.string().uuid(), resourceId: z.string().trim().url().max(500) });

async function context(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return null;
  const workspace = await getPrimaryWorkspace(session.user.id);
  return workspace ? { session, workspace } : null;
}

export async function POST(request: Request) {
  const value = await context(request);
  if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(value.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = connectionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid Bing Webmaster connection' }, { status: 400 });
  let validation: Awaited<ReturnType<typeof validateBingApiKey>>;
  try { validation = await validateBingApiKey(parsed.data.apiKey); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Bing Webmaster validation failed' }, { status: 422 }); }

  const db = getDb();
  const [existing] = await db.select().from(connectorAccounts).where(and(eq(connectorAccounts.workspaceId, value.workspace.id), eq(connectorAccounts.provider, 'bing'), eq(connectorAccounts.externalAccountId, validation.accountFingerprint))).limit(1);
  const connectorId = existing?.id || crypto.randomUUID();
  const encryptedCredentials = await encryptSecret(JSON.stringify({ apiKey: parsed.data.apiKey }), `connector:${value.workspace.id}:${connectorId}`);
  if (existing) await db.update(connectorAccounts).set({ displayName: parsed.data.displayName, encryptedCredentials, status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, connectorId), eq(connectorAccounts.workspaceId, value.workspace.id)));
  else await db.insert(connectorAccounts).values({ id: connectorId, workspaceId: value.workspace.id, provider: 'bing', externalAccountId: validation.accountFingerprint, displayName: parsed.data.displayName, encryptedCredentials, status: 'connected', lastCheckedAt: new Date().toISOString() });

  const resourceIds = validation.sites.map((site) => site.url);
  await db.delete(connectorResources).where(eq(connectorResources.connectorAccountId, connectorId));
  for (const site of validation.sites) await db.insert(connectorResources).values({ id: crypto.randomUUID(), workspaceId: value.workspace.id, connectorAccountId: connectorId, type: 'bing_site', resourceId: site.url, displayName: site.url, domainsJson: JSON.stringify(site.domain ? [site.domain] : []), permissionLevel: 'verified' });
  await db.delete(productConnectorMappings).where(and(eq(productConnectorMappings.workspaceId, value.workspace.id), eq(productConnectorMappings.connectorAccountId, connectorId), eq(productConnectorMappings.source, 'bing'), notInArray(productConnectorMappings.resourceId, resourceIds)));

  const productRows = await db.select().from(products).where(eq(products.workspaceId, value.workspace.id));
  let mapped = 0;
  for (const product of productRows) {
    const domain = normalizeBingDomain(product.domain);
    if (!domain) continue;
    const [alreadyMapped] = await db.select({ id: productConnectorMappings.id }).from(productConnectorMappings).where(and(eq(productConnectorMappings.workspaceId, value.workspace.id), eq(productConnectorMappings.productId, product.id), eq(productConnectorMappings.source, 'bing'))).limit(1);
    if (alreadyMapped) continue;
    const matches = validation.sites.filter((site) => site.domain === domain);
    if (matches.length !== 1) continue;
    await db.insert(productConnectorMappings).values({ id: crypto.randomUUID(), workspaceId: value.workspace.id, productId: product.id, connectorAccountId: connectorId, source: 'bing', resourceId: matches[0].url, resourceLabel: matches[0].url, enabled: true });
    mapped += 1;
  }

  let firstSync: { written: number; errors: string[] } | null = null;
  if (mapped || await db.select({ id: productConnectorMappings.id }).from(productConnectorMappings).where(and(eq(productConnectorMappings.workspaceId, value.workspace.id), eq(productConnectorMappings.connectorAccountId, connectorId), eq(productConnectorMappings.source, 'bing'), eq(productConnectorMappings.enabled, true))).limit(1).then((rows) => rows.length > 0)) {
    firstSync = await syncBingWorkspace(value.workspace.id).catch(() => null);
  }
  await recordAuditEvent({ workspaceId: value.workspace.id, actorUserId: value.session.user.id, action: 'connector.bing_connected', targetType: 'connector', targetId: connectorId, metadata: { discoveredSites: validation.sites.length, autoMappedProducts: mapped, firstSyncWritten: firstSync?.written || 0 } });
  return NextResponse.json({ connector: { id: connectorId, displayName: parsed.data.displayName, status: 'connected' }, discovered: validation.sites.length, mapped, firstSync }, { status: 201 });
}

export async function PUT(request: Request) {
  const value = await context(request);
  if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(value.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = mappingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid Bing Webmaster mapping' }, { status: 400 });
  const [product, resource] = await Promise.all([
    getDb().select({ id: products.id }).from(products).where(and(eq(products.workspaceId, value.workspace.id), eq(products.id, parsed.data.productId))).limit(1),
    getDb().select().from(connectorResources).where(and(eq(connectorResources.workspaceId, value.workspace.id), eq(connectorResources.connectorAccountId, parsed.data.connectorAccountId), eq(connectorResources.type, 'bing_site'), eq(connectorResources.resourceId, parsed.data.resourceId))).limit(1),
  ]);
  if (!product.length || !resource.length) return NextResponse.json({ error: 'Product or Bing Webmaster site not found' }, { status: 404 });
  await getDb().delete(productConnectorMappings).where(and(eq(productConnectorMappings.workspaceId, value.workspace.id), eq(productConnectorMappings.productId, parsed.data.productId), eq(productConnectorMappings.source, 'bing')));
  await getDb().insert(productConnectorMappings).values({ id: crypto.randomUUID(), workspaceId: value.workspace.id, productId: parsed.data.productId, connectorAccountId: parsed.data.connectorAccountId, source: 'bing', resourceId: parsed.data.resourceId, resourceLabel: resource[0].displayName, enabled: true });
  await recordAuditEvent({ workspaceId: value.workspace.id, actorUserId: value.session.user.id, action: 'connector.bing_mapped', targetType: 'connector', targetId: parsed.data.connectorAccountId, metadata: { productId: parsed.data.productId } });
  return NextResponse.json({ mapping: { ...parsed.data, resourceLabel: resource[0].displayName } }, { status: 201 });
}
