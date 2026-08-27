# Connect Cloudflare Pages deployment health

> Compatibility reference: the current Community dashboard does not offer deployment platforms as new business data sources. Existing self-hosted mappings and API routes remain available for compatibility.

Dashloom connects Cloudflare Pages deployment outcomes to Operations and Portfolio Agent evidence. It stores only deployment time, production/preview environment, skipped state, final stage outcome, and derived duration. It does not persist environment variables, build configuration, commit hashes or messages, branches, repository identity, deployment URLs, aliases, source files, build logs, or deployment contents.

## Create least-privilege access

1. Open **Cloudflare → Manage Account → Account API Tokens**.
2. Create a custom token with account-level **Cloudflare Pages → Read** (shown as **Pages Read** in the API permission reference).
3. Scope the token to the account that owns the Pages project.
4. Copy the account ID and exact Pages project name.

Do not grant Pages Write. Dashloom never creates, retries, rolls back, or deletes a deployment.

## Connect and synchronize

Open **Dashboard → Data sources → Cloudflare Pages**. Select a Dashloom product, enter the account ID, exact project name, and read-only token, then connect. Pages uses an independent encrypted connector credential, so a narrowly scoped Pages token cannot overwrite a Worker or R2 analytics token for the same Cloudflare account.

Manual and scheduled synchronization refresh the preceding 60 days plus today and normalize:

- total, successful, failed, canceled, skipped, and production deployments by day;
- average time from deployment creation until its final stage ended, when both timestamps exist;
- whether the latest completed, non-skipped deployment succeeded;
- days since the latest non-skipped deployment.

Collection is bounded to five API pages and 500 deployment records per project. If more pages exist, every collected metric carries a `truncated` evidence marker and the Agent must disclose partial coverage. Dashloom does not claim deployment duration is end-user latency or runtime performance.

Cloudflare's deployment response can contain sensitive build and source metadata. Dashloom deliberately discards those fields during normalization and never writes them to metrics, sync errors, audit metadata, or Agent evidence. Official references: [Get Pages deployments](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/) and [API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/).

## Troubleshooting

- **403:** confirm the token has account-level Pages Read and includes the selected account.
- **404:** confirm the account ID and exact Pages project name.
- **No duration:** a completed final-stage timestamp was not available; outcome counts can still synchronize.
- **Partial run:** more than 500 deployments were available in the bounded collection; narrow interpretation to the evidence that was actually imported.

Reconnect the same Cloudflare Pages account to rotate its encrypted token.
