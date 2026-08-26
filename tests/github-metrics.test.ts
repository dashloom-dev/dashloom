import assert from 'node:assert/strict';
import test from 'node:test';
import { githubMetricValues } from '../lib/github-metrics.ts';

test('GitHub repository snapshots preserve stocks and aggregate activity by day', () => {
  const result = githubMetricValues(
    { stargazers_count: 42, forks_count: 7, open_issues_count: 5, subscribers_count: 3, watchers_count: 42, size: 1024, pushed_at: '2026-08-24T00:00:00Z', archived: false },
    [{ commit: { committer: { date: '2026-08-25T10:00:00Z' } } }, { commit: { committer: { date: '2026-08-25T12:00:00Z' } } }, { commit: { committer: null } }],
    [{ published_at: '2026-08-25T14:00:00Z', draft: false }, { published_at: '2026-08-25T15:00:00Z', draft: true }],
    new Date('2026-08-26T12:00:00Z'),
  );
  assert.equal(result.stocks.repo_stars, 42);
  assert.equal(result.stocks.repo_watchers, 3);
  assert.equal(result.stocks.repo_days_since_push, 2);
  assert.deepEqual(result.daily.get('2026-08-25'), { commits: 2, releases: 1 });
});

test('GitHub repository snapshots do not retain commit identity fields', () => {
  const result = githubMetricValues(
    { stargazers_count: 0, forks_count: 0, open_issues_count: 0, watchers_count: 0, size: 0, pushed_at: null, archived: true },
    [{ commit: { committer: { date: '2026-08-26T10:00:00Z' } } }], [], new Date('2026-08-26T12:00:00Z'),
  );
  assert.equal(result.stocks.repo_archived, 1);
  assert.deepEqual([...result.daily.values()], [{ commits: 1, releases: 0 }]);
});
