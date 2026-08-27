# Connect GitHub repository activity

> Compatibility reference: the current Community dashboard does not offer code-hosting activity as a new business data source. Existing self-hosted mappings and API routes remain available for compatibility.

Dashloom connects repository delivery evidence to the same product that already contains traffic, revenue, SEO, and operations metrics. It reads summary metadata, recent commits, and published releases; it does not store source code, commit messages, file contents, or author identity.

## Create a fine-grained token

1. Open **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Choose only the repository or repositories that belong in this Dashloom workspace.
3. Set **Repository permissions → Metadata** to read-only.
4. Set **Repository permissions → Contents** to read-only. This is required by GitHub's commits and releases endpoints.
5. Do not grant write, administration, organization, issue, or pull-request permissions.
6. Set an expiration date and copy the token once.

## Connect and map

Open **Dashboard → Data sources → GitHub product activity**. Choose a Dashloom product, enter `owner/repository`, add the token, and connect. Repeating the process for a different GitHub identity creates another account; mapping another product under the same identity safely reuses the encrypted account connection.

Select **Sync GitHub** or add a GitHub automation schedule. Dashloom imports:

- stars, forks, watchers, repository size, archived status, and days since the last push;
- the current count of open issues and pull requests reported by GitHub's repository summary;
- daily commit and published-release counts for the recent 30-day window.

Commit retrieval is bounded to 300 rows per repository per sync. A result at that limit is marked as truncated in the sync response instead of pretending the count is complete.

## Troubleshooting

- **404:** the token does not have access to the selected repository, or the name is wrong.
- **401:** the token is invalid or expired.
- **403/429:** wait for the reported GitHub rate-limit reset before retrying.
- **No commits:** an empty repository can return a conflict response; Dashloom treats that as a valid zero-commit state.

Rotate a token by reconnecting the same GitHub identity. The new encrypted credential replaces the old value for that workspace.
