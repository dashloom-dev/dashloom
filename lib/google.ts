import { env } from 'cloudflare:workers';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, connectorResources, metricPoints, oauthStates, productConnectorMappings, products, syncRuns } from '@/db/schema';
import { decryptSecret, encryptSecret } from './crypto';
import { SYNC_HISTORY_DAYS, syncHistoryStart } from './history-window';

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

type GoogleTokens = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string };
type GoogleCredentials = { refreshToken: string; scopes: string };
export type GoogleResource = { type: 'ga4' | 'gsc'; resourceId: string; displayName: string; domains: string[]; permissionLevel: string | null };

function config() {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) throw new Error('Google OAuth is not configured for this deployment.');
  const baseUrl = (env.BETTER_AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  return { clientId: env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET, redirectUri: `${baseUrl}/api/connectors/google/callback` };
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value: string) { return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); }
function randomToken(length = 32) { return base64Url(crypto.getRandomValues(new Uint8Array(length))); }

export async function createGoogleAuthorization(workspaceId: string, userId: string) {
  const { clientId, redirectUri } = config();
  const state = randomToken(32);
  const verifier = randomToken(48);
  const id = crypto.randomUUID();
  await getDb().delete(oauthStates).where(and(eq(oauthStates.provider, 'google'), sql`${oauthStates.expiresAt} <= datetime('now')`));
  await getDb().insert(oauthStates).values({ id, workspaceId, userId, provider: 'google', stateHash: await sha256(state), encryptedVerifier: await encryptSecret(verifier, `oauth-state:${id}`), redirectUri, expiresAt: new Date(Date.now() + 10 * 60000).toISOString() });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', await sha256(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function exchangeCode(code: string, verifier: string, redirectUri: string) {
  const { clientId, clientSecret } = config();
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Google token exchange returned HTTP ${response.status}.`);
  return response.json() as Promise<GoogleTokens>;
}

async function accessToken(refreshToken: string) {
  const { clientId, clientSecret } = config();
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Google token refresh returned HTTP ${response.status}.`);
  return (await response.json() as GoogleTokens).access_token;
}

async function fetchJson<T>(url: string, token: string) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Google resource request returned HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}

function normalizeDomain(value?: string | null) {
  if (!value) return null;
  const stripped = value.replace(/^sc-domain:/i, '').trim();
  try { return new URL(stripped.includes('://') ? stripped : `https://${stripped}`).hostname.replace(/^www\./i, '').toLowerCase(); }
  catch { return stripped.replace(/^www\./i, '').replace(/\/$/, '').toLowerCase() || null; }
}

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function discoverResources(token: string) {
  const properties: Array<{ property: string; displayName: string }> = [];
  let pageToken = '';
  do {
    const url = new URL('https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
    url.searchParams.set('pageSize', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const result = await fetchJson<{ accountSummaries?: Array<{ propertySummaries?: Array<{ property?: string; displayName?: string }> }>; nextPageToken?: string }>(url.toString(), token);
    for (const account of result.accountSummaries || []) for (const property of account.propertySummaries || []) if (property.property) properties.push({ property: property.property, displayName: property.displayName || property.property });
    pageToken = result.nextPageToken || '';
  } while (pageToken);

  const ga4: GoogleResource[] = [];
  for (let index = 0; index < properties.length; index += 4) {
    const batch = await Promise.all(properties.slice(index, index + 4).map(async (property) => {
      const result = await fetchJson<{ dataStreams?: Array<{ type?: string; webStreamData?: { defaultUri?: string } }> }>(`https://analyticsadmin.googleapis.com/v1beta/${property.property}/dataStreams?pageSize=200`, token);
      return { type: 'ga4' as const, resourceId: property.property.replace(/^properties\//, ''), displayName: property.displayName, domains: [...new Set((result.dataStreams || []).filter((stream) => stream.type === 'WEB_DATA_STREAM').map((stream) => normalizeDomain(stream.webStreamData?.defaultUri)).filter((domain): domain is string => Boolean(domain)))], permissionLevel: null };
    }));
    ga4.push(...batch);
  }
  const sites = await fetchJson<{ siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> }>('https://www.googleapis.com/webmasters/v3/sites', token);
  const gsc: GoogleResource[] = (sites.siteEntry || []).flatMap((site) => site.siteUrl ? [{ type: 'gsc' as const, resourceId: site.siteUrl, displayName: site.siteUrl, domains: [normalizeDomain(site.siteUrl)].filter((domain): domain is string => Boolean(domain)), permissionLevel: site.permissionLevel || null }] : []);
  return [...ga4, ...gsc];
}

async function replaceResources(workspaceId: string, connectorId: string, resources: GoogleResource[]) {
  const db = getDb();
  await db.delete(connectorResources).where(eq(connectorResources.connectorAccountId, connectorId));
  for (const resource of resources) await db.insert(connectorResources).values({ id: crypto.randomUUID(), workspaceId, connectorAccountId: connectorId, type: resource.type, resourceId: resource.resourceId, displayName: resource.displayName, domainsJson: JSON.stringify(resource.domains), permissionLevel: resource.permissionLevel });
  const productRows = await db.select().from(products).where(eq(products.workspaceId, workspaceId));
  for (const product of productRows) {
    const domain = normalizeDomain(product.domain);
    if (!domain) continue;
    for (const source of ['ga4', 'gsc'] as const) {
      const existing = await db.select({ id: productConnectorMappings.id }).from(productConnectorMappings).where(and(eq(productConnectorMappings.productId, product.id), eq(productConnectorMappings.source, source))).limit(1);
      if (existing.length) continue;
      const matches = resources.filter((resource) => resource.type === source && resource.domains.includes(domain));
      if (matches.length === 1) await db.insert(productConnectorMappings).values({ id: crypto.randomUUID(), workspaceId, productId: product.id, connectorAccountId: connectorId, source, resourceId: matches[0].resourceId, resourceLabel: matches[0].displayName, enabled: true });
    }
  }
}

export async function completeGoogleAuthorization(state: string, code: string) {
  const stateHash = await sha256(state);
  const [row] = await getDb().select().from(oauthStates).where(and(eq(oauthStates.provider, 'google'), eq(oauthStates.stateHash, stateHash))).limit(1);
  if (!row || Date.parse(row.expiresAt) <= Date.now()) throw new Error('Google authorization state is invalid or expired.');
  await getDb().delete(oauthStates).where(eq(oauthStates.id, row.id));
  const verifier = await decryptSecret(row.encryptedVerifier, `oauth-state:${row.id}`);
  const tokens = await exchangeCode(code, verifier, row.redirectUri);
  if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Revoke the old grant and connect again.');
  const identity = await fetchJson<{ sub: string; email?: string }>('https://www.googleapis.com/oauth2/v3/userinfo', tokens.access_token);
  const [existing] = await getDb().select().from(connectorAccounts).where(and(eq(connectorAccounts.workspaceId, row.workspaceId), eq(connectorAccounts.provider, 'google'), eq(connectorAccounts.externalAccountId, identity.sub))).limit(1);
  const connectorId = existing?.id || crypto.randomUUID();
  const encryptedCredentials = await encryptSecret(JSON.stringify({ refreshToken: tokens.refresh_token, scopes: tokens.scope || GOOGLE_SCOPES.join(' ') } satisfies GoogleCredentials), `connector:${row.workspaceId}:${connectorId}`);
  if (existing) await getDb().update(connectorAccounts).set({ displayName: identity.email || 'Google account', encryptedCredentials, status: 'pending', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(connectorAccounts.id, connectorId));
  else await getDb().insert(connectorAccounts).values({ id: connectorId, workspaceId: row.workspaceId, provider: 'google', externalAccountId: identity.sub, displayName: identity.email || 'Google account', encryptedCredentials, status: 'pending', lastCheckedAt: new Date().toISOString() });
  const resources = await discoverResources(tokens.access_token);
  await replaceResources(row.workspaceId, connectorId, resources);
  await getDb().update(connectorAccounts).set({ status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(connectorAccounts.id, connectorId));
  return { workspaceId: row.workspaceId, connectorId, resourceCount: resources.length };
}

async function upsertPoints(points: Array<typeof metricPoints.$inferInsert>) {
  for (let index = 0; index < points.length; index += 10) await getDb().insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
}

export async function syncGoogleWorkspace(workspaceId: string) {
  const db = getDb();
  const connectors = await db.select().from(connectorAccounts).where(and(eq(connectorAccounts.workspaceId, workspaceId), eq(connectorAccounts.provider, 'google'), eq(connectorAccounts.status, 'connected')));
  if (!connectors.length) throw new Error('No connected Google account was found.');
  let total = 0;
  const errors: string[] = [];
  for (const connector of connectors) {
    const runId = crypto.randomUUID();
    await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: connector.id, source: 'google', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!connector.encryptedCredentials) throw new Error('Google refresh credentials are missing.');
      const credentials = JSON.parse(await decryptSecret(connector.encryptedCredentials, `connector:${workspaceId}:${connector.id}`)) as GoogleCredentials;
      const token = await accessToken(credentials.refreshToken);
      const mappings = await db.select({ mapping: productConnectorMappings, product: products }).from(productConnectorMappings).innerJoin(products, eq(productConnectorMappings.productId, products.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.connectorAccountId, connector.id), eq(productConnectorMappings.enabled, true)));
      const results = await Promise.allSettled(mappings.map(async ({ mapping, product }) => {
        if (mapping.source === 'ga4') return syncGa4Mapping(workspaceId, product.id, product.domain, mapping.resourceId, token);
        if (mapping.source === 'gsc') return syncGscMapping(workspaceId, product.id, mapping.resourceId, token);
        return [];
      }));
      const points = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
      const connectorErrors = results.flatMap((result) => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : 'Google mapping failed'] : []);
      await upsertPoints(points); total += points.length; errors.push(...connectorErrors);
      await db.update(syncRuns).set({ status: connectorErrors.length ? 'partial' : 'success', recordsWritten: points.length, errorMessage: connectorErrors.join('; ').slice(0, 500) || null, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId));
      await db.update(connectorAccounts).set({ status: connectorErrors.length === results.length && results.length ? 'attention' : 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(connectorAccounts.id, connector.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sync failed'; errors.push(message);
      await db.update(syncRuns).set({ status: 'error', errorCode: 'GOOGLE_SYNC_FAILED', errorMessage: message.slice(0, 500), finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId));
      await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(connectorAccounts.id, connector.id));
    }
  }
  return { written: total, errors };
}

async function syncGa4Mapping(workspaceId: string, productId: string, domain: string | null, propertyId: string, token: string) {
  const normalized = normalizeDomain(domain);
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ dateRanges: [{ startDate: `${SYNC_HISTORY_DAYS}daysAgo`, endDate: 'today' }], dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }], ...(normalized ? { dimensionFilter: { filter: { fieldName: 'hostName', stringFilter: { matchType: 'FULL_REGEXP', value: `^(www\\.)?${escapeRegex(normalized)}$`, caseSensitive: false } } } } : {}), limit: '1000' }), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`GA4 property ${propertyId} returned HTTP ${response.status}.`);
  const payload = await response.json() as { rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }> };
  return (payload.rows || []).flatMap((row) => { const raw = row.dimensionValues?.[0]?.value || ''; if (!/^\d{8}$/.test(raw)) return []; const metricDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`; const values = row.metricValues || []; return [['active_users', values[0]], ['sessions', values[1]], ['page_views', values[2]]].map(([metric, value]) => ({ workspaceId, productId, source: 'ga4', metric: String(metric), metricDate, value: Number((value as { value?: string })?.value || 0), dimensionsJson: '{}', collectedAt: new Date().toISOString() })); });
}

async function syncGscMapping(workspaceId: string, productId: string, siteUrl: string, token: string) {
  const startDate = syncHistoryStart();
  const endDate = new Date().toISOString().slice(0, 10);
  const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ startDate, endDate, dimensions: ['date'], rowLimit: 25000, dataState: 'all' }), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Search Console site ${siteUrl} returned HTTP ${response.status}.`);
  const payload = await response.json() as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> };
  return (payload.rows || []).flatMap((row) => { const metricDate = row.keys?.[0]; if (!metricDate) return []; return [['clicks', row.clicks || 0], ['impressions', row.impressions || 0], ['ctr', row.ctr || 0], ['position', row.position || 0]].map(([metric, value]) => ({ workspaceId, productId, source: 'gsc', metric: String(metric), metricDate, value: Number(value), dimensionsJson: '{}', collectedAt: new Date().toISOString() })); });
}
