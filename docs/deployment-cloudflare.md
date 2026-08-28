# Deploy Dashloom Community on Cloudflare

This path runs Dashloom with Vinext on Cloudflare Workers and stores the complete application state in a native D1 binding named `DB`. The scheduled handler in `worker.ts` runs every 15 minutes through the committed `wrangler.jsonc` trigger.

Use a fresh Community-only D1 database. Do not point this repository at a Dashloom Cloud or pre-release database.

## Prerequisites

- Node.js 22.13 or newer and npm 10 or newer
- A Cloudflare account with permission to create Workers and D1 databases
- Wrangler authentication (`npx wrangler login`) or an equivalent CI API token
- A public application origin for `BETTER_AUTH_URL`

Clone and install the project:

```bash
git clone https://github.com/dashloom-dev/dashloom.git
cd dashloom
npm ci
```

## 1. Create and bind the production D1 database

Create a database with a name you control:

```bash
npx wrangler d1 create dashloom-production
```

Copy the returned database name and UUID into the existing `d1_databases` entry in `wrangler.jsonc`. Keep the binding name and migrations directory unchanged:

```json
{
  "binding": "DB",
  "database_name": "dashloom-production",
  "database_id": "YOUR-D1-DATABASE-UUID",
  "migrations_dir": "./drizzle"
}
```

Confirm that Wrangler resolves the intended production database before applying anything:

```bash
npx wrangler d1 info dashloom-production --json
```

The reported UUID must match `database_id` in `wrangler.jsonc`.

## 2. Choose the deployment language

Set the non-secret `DASHLOOM_DEFAULT_LOCALE` value under `vars` in `wrangler.jsonc`:

```json
"vars": {
  "DASHLOOM_DEFAULT_LOCALE": "en"
}
```

Use `en` for English or `zh-CN` for Simplified Chinese. This controls authentication, recovery emails, navigation, and product pages for the whole Community deployment. Community does not expose localized dashboard routes or an in-app language switch; change this value and rebuild to change the deployment language.

## 3. Configure production secrets

Generate separate random values for authentication, credential encryption, and cron authentication. Then save them with Wrangler:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put CREDENTIALS_ENCRYPTION_KEY
npx wrangler secret put REPORT_CRON_SECRET
```

`BETTER_AUTH_URL` must be the final HTTPS origin, for example `https://dashloom.example.com`. `BETTER_AUTH_SECRET` and `CREDENTIALS_ENCRYPTION_KEY` must each be at least 32 characters and must not reuse the same value.

Add the following only when the feature is enabled:

```bash
npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
npx wrangler secret put AUTH_EMAIL_WEBHOOK_URL
npx wrangler secret put AUTH_EMAIL_WEBHOOK_SECRET
```

Keep real secrets out of `.dev.vars`, `wrangler.jsonc`, Git history, and `NEXT_PUBLIC_*` variables. Set `AUTH_REQUIRE_EMAIL_VERIFICATION=true` only after the production email relay has been tested.

## 4. Apply and verify remote migrations

List the pending migrations against the exact production database, apply them, and list again:

```bash
npx wrangler d1 migrations list dashloom-production --remote
npx wrangler d1 migrations apply dashloom-production --remote
npx wrangler d1 migrations list dashloom-production --remote
```

The final list must show no pending migration. Then query that same remote database and confirm the application tables exist:

```bash
npx wrangler d1 execute dashloom-production --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workspaces','workspace_members','products','metric_points','analysis_runs','reports') ORDER BY name;"
```

A migration file in `drizzle/` is only an input. Production migration work is complete only after the intended database UUID is confirmed, migrations are applied remotely, no migration remains pending, and critical tables are present.

## 5. Build and deploy

Validate the Worker bundle before publishing:

```bash
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy
```

The committed Cron trigger runs `worker.ts` every 15 minutes, so no separate scheduler is required on this path. After the first deployment, attach the custom domain if needed and update `BETTER_AUTH_URL` whenever the canonical origin changes.

## 6. Verify the production deployment

Test against the deployed origin:

1. Create or sign in to an account and verify the selected deployment language.
2. Confirm dashboard navigation and product pages use that language and workspace switching remains isolated.
3. Add one product and run one connector synchronization.
4. Add an OpenAI-compatible BYOK model and run one cited Agent analysis.
5. Create a due synchronization or report schedule and confirm the Worker Cron records its execution.
6. Test export and password recovery before enabling mandatory email verification.

## Upgrades and rollback

Before a risky upgrade, back up the intended D1 database and record a Time Travel bookmark as described in the [backup and recovery guide](backup-and-recovery.md). Apply new migrations before shifting traffic to the new Worker.

If application verification fails, redeploy the previous Worker version. Do not reverse a database migration by deleting tables or editing migration history. Restore the database only from an approved backup or Time Travel bookmark, then re-run migration and schema verification.

## Troubleshooting

- **`DB` binding is unavailable:** keep the binding name exactly `DB` and verify the database UUID in `wrangler.jsonc`.
- **Authentication redirects to the wrong host:** update `BETTER_AUTH_URL` to the final HTTPS origin and redeploy.
- **The UI starts in the wrong language:** use exactly `en` or `zh-CN` for `DASHLOOM_DEFAULT_LOCALE`; existing workspace preferences are intentionally preserved.
- **Scheduled work does not run:** confirm the deployed Worker has the Cron trigger and inspect the automation ledger for task-level failures.
- **A table is missing after deployment:** stop traffic-changing work, verify the database UUID, re-run the remote migration list, and apply only the repository migration set.

For Cloudflare analytics as a business data source, use the separate [Cloudflare connector compatibility guide](cloudflare-setup.md). Deploying Dashloom on Cloudflare does not automatically connect Cloudflare analytics.
