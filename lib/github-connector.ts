import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { connectorAccounts, metricPoints, productConnectorMappings, syncRuns } from '@/db/schema';
import { decryptSecret } from './crypto';
import { githubMetricValues, type GitHubCommit, type GitHubRelease, type GitHubRepositorySnapshot } from './github-metrics';
import { SYNC_HISTORY_DAYS } from './history-window';

const apiOrigin = 'https://api.github.com'; const apiVersion = '2026-03-10';
type Credentials = { token: string; login: string };
type User = { id: number; login: string };
type Repository = GitHubRepositorySnapshot & { id: number; full_name: string; private: boolean };

async function githubGet<T>(token: string, path: string, options: { allowConflict?: boolean } = {}) {
  const response = await fetch(`${apiOrigin}${path}`, { headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'user-agent': 'Dashloom', 'x-github-api-version': apiVersion }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (options.allowConflict && response.status === 409) return [] as T;
  if (!response.ok) { const retry = response.headers.get('retry-after'); const reset = response.headers.get('x-ratelimit-reset'); const suffix = retry ? ` Retry after ${retry} seconds.` : reset ? ` Rate limit resets at ${new Date(Number(reset) * 1000).toISOString()}.` : ''; throw new Error(`GitHub returned HTTP ${response.status}. Check token access and repository selection.${suffix}`); }
  return response.json() as Promise<T>;
}

async function listPages<T>(token: string, path: string, maxPages = 3, allowConflict = false) {
  const rows: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) { const separator = path.includes('?') ? '&' : '?'; const result = await githubGet<T[]>(token, `${path}${separator}per_page=100&page=${page}`, { allowConflict }); rows.push(...result); if (result.length < 100) break; }
  return rows;
}

export function parseGitHubRepository(value: string) { const normalized = value.trim().replace(/^https:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, ''); if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized) || normalized.includes('..')) throw new Error('Use a repository in owner/name format.'); return normalized; }

export async function validateGitHubCredentials(token: string, repository: string) {
  const repoPath = parseGitHubRepository(repository); const [user, repo] = await Promise.all([githubGet<User>(token, '/user'), githubGet<Repository>(token, `/repos/${repoPath.split('/').map(encodeURIComponent).join('/')}`)]);
  if (!user.id || !user.login || !repo.id || !repo.full_name) throw new Error('GitHub identity or repository metadata is unavailable.');
  return { accountId: String(user.id), login: user.login, repositoryId: String(repo.id), repository: repo.full_name, private: repo.private };
}

export async function syncGitHubWorkspace(workspaceId: string) {
  const db = getDb(); const mappings = await db.select({ mapping: productConnectorMappings, connector: connectorAccounts }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(and(eq(productConnectorMappings.workspaceId, workspaceId), eq(productConnectorMappings.source, 'github'), eq(productConnectorMappings.enabled, true), eq(connectorAccounts.status, 'connected')));
  if (!mappings.length) throw new Error('No connected GitHub repository mappings were found.');
  let written = 0; const summaries: Array<{ connectorId: string; repository: string; records: number; truncated: boolean }> = [];
  for (const item of mappings) {
    const runId = crypto.randomUUID(); await db.insert(syncRuns).values({ id: runId, workspaceId, connectorAccountId: item.connector.id, source: 'github', status: 'running', startedAt: new Date().toISOString() });
    try {
      if (!item.connector.encryptedCredentials) throw new Error('GitHub credentials are missing.'); const credentials = JSON.parse(await decryptSecret(item.connector.encryptedCredentials, `connector:${workspaceId}:${item.connector.id}`)) as Credentials; const repository = parseGitHubRepository(item.mapping.resourceLabel || item.mapping.resourceId); const encoded = repository.split('/').map(encodeURIComponent).join('/'); const cutoff = new Date(Date.now() - SYNC_HISTORY_DAYS * 86400000); const since = cutoff.toISOString();
      const [snapshot, commits, releases] = await Promise.all([githubGet<Repository>(credentials.token, `/repos/${encoded}`), listPages<GitHubCommit>(credentials.token, `/repos/${encoded}/commits?since=${encodeURIComponent(since)}`, 3, true), listPages<GitHubRelease>(credentials.token, `/repos/${encoded}/releases`, 1)]); const recentReleases = releases.filter((release) => release.published_at && new Date(release.published_at) >= cutoff); const values = githubMetricValues(snapshot, commits, recentReleases); const today = new Date().toISOString().slice(0, 10); const dimensionsJson = JSON.stringify({ repository: snapshot.full_name }); const collectedAt = new Date().toISOString();
      await db.delete(metricPoints).where(and(eq(metricPoints.workspaceId, workspaceId), eq(metricPoints.productId, item.mapping.productId), eq(metricPoints.source, 'github'), inArray(metricPoints.metric, ['repo_commits', 'repo_releases']), gte(metricPoints.metricDate, cutoff.toISOString().slice(0, 10))));
      const points = Object.entries(values.stocks).map(([metric, value]) => ({ workspaceId, productId: item.mapping.productId, source: 'github', metric, metricDate: today, value, dimensionsJson, collectedAt })); for (const [metricDate, value] of values.daily) { if (value.commits) points.push({ workspaceId, productId: item.mapping.productId, source: 'github', metric: 'repo_commits', metricDate, value: value.commits, dimensionsJson, collectedAt }); if (value.releases) points.push({ workspaceId, productId: item.mapping.productId, source: 'github', metric: 'repo_releases', metricDate, value: value.releases, dimensionsJson, collectedAt }); }
      for (let index = 0; index < points.length; index += 10) await db.insert(metricPoints).values(points.slice(index, index + 10)).onConflictDoUpdate({ target: [metricPoints.workspaceId, metricPoints.productId, metricPoints.source, metricPoints.metric, metricPoints.metricDate, metricPoints.dimensionsJson], set: { value: sql`excluded.value`, collectedAt: sql`excluded.collected_at` } }); written += points.length; summaries.push({ connectorId: item.connector.id, repository: snapshot.full_name, records: points.length, truncated: commits.length >= 300 }); await db.update(syncRuns).set({ status: 'success', recordsWritten: points.length, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'connected', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId)));
    } catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : 'GitHub sync failed.'; await db.update(syncRuns).set({ status: 'error', errorCode: 'GITHUB_SYNC_FAILED', errorMessage: message, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, runId)); await db.update(connectorAccounts).set({ status: 'attention', lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(connectorAccounts.id, item.connector.id), eq(connectorAccounts.workspaceId, workspaceId))); throw error; }
  }
  return { written, connectors: summaries };
}
