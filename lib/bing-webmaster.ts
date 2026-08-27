import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { bingPagePoints, bingQueryPoints, bingTrafficPoints, type BingDimensionRow, type BingTrafficRow } from './bing-webmaster-metrics';
import { syncHistoryStart } from './history-window';

const apiOrigin = 'https://ssl.bing.com/webmaster/api.svc/json';
type Credentials = { apiKey: string };
export type BingSite = { url: string; domain: string | null; verified: boolean };

export function normalizeBingDomain(value?: string | null) {
  if (!value) return null;
  try { return new URL(value.includes('://') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase(); }
  catch { return null; }
}

async function bingGet<T>(apiKey: string, method: 'GetUserSites' | 'GetRankAndTrafficStats' | 'GetQueryStats' | 'GetPageStats', siteUrl?: string) {
  const url = new URL(`${apiOrigin}/${method}`);
  url.searchParams.set('apikey', apiKey);
  if (siteUrl) url.searchParams.set('siteUrl', siteUrl);
  const response = await fetch(url, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  const text = await response.text();
  let payload: { d?: T; ErrorCode?: string; Message?: string } = {};
  try { payload = JSON.parse(text) as typeof payload; } catch { /* handled below */ }
  const remoteMessage = `${payload.ErrorCode || ''} ${payload.Message || ''}`;
  if (!response.ok || payload.ErrorCode) {
    if (response.status === 401 || /InvalidApiKey|AccessDenied|Unauthorized/i.test(remoteMessage)) throw new Error('The Bing Webmaster API key is invalid or no longer authorized.');
    if (response.status === 429 || /quota|rate/i.test(remoteMessage)) throw new Error('Bing Webmaster rate limit reached. Try again later.');
    throw new Error(`Bing Webmaster returned HTTP ${response.status}. Check the API key and site permission.`);
  }
  if (payload.d === undefined) throw new Error('Bing Webmaster returned an unexpected response.');
  return payload.d;
}

export async function fingerprintBingApiKey(apiKey: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function discoverBingSites(apiKey: string) {
  const sites = await bingGet<Array<{ IsVerified?: boolean; Url?: string }>>(apiKey, 'GetUserSites');
  return sites.flatMap((site): BingSite[] => site.Url ? [{ url: site.Url, domain: normalizeBingDomain(site.Url), verified: site.IsVerified !== false }] : []);
}

export async function validateBingApiKey(apiKey: string) {
  const sites = await discoverBingSites(apiKey);
  const verifiedSites = sites.filter((site) => site.verified);
  if (!verifiedSites.length) throw new Error('No verified Bing Webmaster sites are available to this API key.');
  return { accountFingerprint: await fingerprintBingApiKey(apiKey), sites: verifiedSites };
}

async function syncBingSite(workspaceId: string, productId: string, siteUrl: string, apiKey: string) {
  const [trafficRows, queryRows, pageRows] = await Promise.all([
    bingGet<BingTrafficRow[]>(apiKey, 'GetRankAndTrafficStats', siteUrl),
    bingGet<BingDimensionRow[]>(apiKey, 'GetQueryStats', siteUrl),
    bingGet<BingDimensionRow[]>(apiKey, 'GetPageStats', siteUrl),
  ]);
  const collectedAt = new Date().toISOString();
  const minimumDate = syncHistoryStart();
  return [...bingTrafficPoints(trafficRows, minimumDate, collectedAt), ...bingQueryPoints(queryRows, minimumDate, collectedAt), ...bingPagePoints(pageRows, minimumDate, collectedAt)].map((point) => ({ ...point, workspaceId, productId, source: 'bing' as const }));
}

export async function syncBingWorkspace(workspaceId: string) {
  const db = getDb();
  const connectors = await db.select().from(connectorAccounts).where(and(eq(connectorAccounts.workspaceId, workspaceId), eq(connectorAccounts.provider, 'bing'), eq(connectorAccounts.status, 'connected')));
  if (!connectors.length) throw new Error('No connected Bing Webmaster account was found.');
  let written = 0;
  const errors: string[] = [];
  for (const connector of connectors) {
    const runId = crypto.randomUUID();
    await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: connector.id, source: 'bing', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!connector.encryptedCredentials) throw new Error('Bing Webmaster credentials are missing.');
      const { apiKey } = JSON.parse(await decryptSecret(connector.encryptedCredentials, `connector:${workspaceId}:${connector.id}`)) as Credentials;
      const mappings = await db.select().from(productConnectorMappings).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.connectorAccountId, connector.id), eq(productConnectorMappings.source, 'bing'), eq(productConnectorMappings.enabled, true)));
      if (!mappings.length) throw new Error('No active Bing Webmaster site mappings were found.');
      const results = await Promise.allSettled(mappings.map((mapping) => syncBingSite(workspaceId, mapping.productId, mapping.resourceId, apiKey)));
      const points = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
      const connectorErrors = results.flatMap((result) => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : 'Bing Webmaster mapping failed.'] : []);
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } });
      written += points.length; errors.push(...connectorErrors);
      await db.update(syncRuns).set({ status: connectorErrors.length ? 'partial' : 'success', recordsWritten: points.length, errorMessage: connectorErrors.join('; ').slice(0, 500) || null, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId));
      await db.update(connectorAccounts).set({ status: connectorErrors.length === results.length ? 'attention' : 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Bing Webmaster sync failed.';
      errors.push(message);
      await db.update(syncRuns).set({ status: 'error', errorCode: 'BING_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId));
      await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    }
  }
  return { written, errors };
}
