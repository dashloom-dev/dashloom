export type GitHubRepositorySnapshot = {
  stargazers_count: number; forks_count: number; open_issues_count: number;
  subscribers_count?: number; watchers_count: number; size: number;
  pushed_at: string | null; archived: boolean;
};
export type GitHubCommit = { commit: { committer: { date: string | null } | null } };
export type GitHubRelease = { published_at: string | null; draft: boolean };

export function githubMetricValues(repository: GitHubRepositorySnapshot, commits: GitHubCommit[], releases: GitHubRelease[], now = new Date()) {
  const daily = new Map<string, { commits: number; releases: number }>();
  for (const row of commits) { const date = row.commit.committer?.date?.slice(0, 10); if (!date) continue; const value = daily.get(date) || { commits: 0, releases: 0 }; value.commits += 1; daily.set(date, value); }
  for (const row of releases) { const date = row.published_at?.slice(0, 10); if (!date || row.draft) continue; const value = daily.get(date) || { commits: 0, releases: 0 }; value.releases += 1; daily.set(date, value); }
  const pushedAt = repository.pushed_at ? new Date(repository.pushed_at) : null; const daysSincePush = pushedAt && Number.isFinite(pushedAt.getTime()) ? Math.max(0, Math.floor((now.getTime() - pushedAt.getTime()) / 86400000)) : 0;
  return {
    stocks: {
      repo_stars: repository.stargazers_count,
      repo_forks: repository.forks_count,
      repo_open_issues_and_pulls: repository.open_issues_count,
      repo_watchers: repository.subscribers_count ?? repository.watchers_count,
      repo_size_kb: repository.size,
      repo_days_since_push: daysSincePush,
      repo_archived: repository.archived ? 1 : 0,
    },
    daily,
  };
}
