# Deploy the Community edition on Vercel or AWS

Dashloom Community has three real runtime paths:

- **Cloudflare native:** Vinext runs in Workers and uses the `DB` D1 binding directly.
- **Next.js on Vercel or AWS with remote D1:** Next.js runs in Node.js and sends parameterized Drizzle queries to D1 through Cloudflare's authenticated HTTP API.
- **Next.js on Vercel or AWS with Supabase:** Next.js runs in Node.js and stores the complete application state in Supabase PostgreSQL through the PostgreSQL adapter.

Cloudflare Workers, Vercel, and AWS are deployment targets. They are not business data sources and do not appear in the Dashboard data-source catalog.

For the native Worker path, use the [Cloudflare deployment guide](deployment-cloudflare.md).

## Prerequisites

- Node.js 22.13 or newer and npm 10 or newer
- A Vercel project, AWS Amplify Hosting app, or another compatible Node.js host
- One fresh Community-only Remote D1 database or Supabase project
- A public HTTPS origin for authentication callbacks

Run `npm ci` and `npm test` locally before connecting the repository to the host.

## Required environment variables

Copy `node-runtime.env.example` into the environment-variable settings for the selected platform. Always configure the authentication, credential-encryption, and cron secrets. Then choose exactly one storage backend:

- Language: set `DASHLOOM_DEFAULT_LOCALE=en` or `DASHLOOM_DEFAULT_LOCALE=zh-CN`. It selects the default authentication and recovery language and the locale assigned to new workspaces. Workspace owners can change their locale later; changing the deployment value does not overwrite existing workspaces.
- D1: set `DASHLOOM_DATABASE=d1` and configure the three `CLOUDFLARE_*` fields with a dedicated token scoped to the intended database.
- Supabase: set `DASHLOOM_DATABASE=supabase` and configure `SUPABASE_DATABASE_URL`. Prefer the Supabase transaction pooler URL for serverless hosting. TLS is required by default and prepared statements are disabled for pooler compatibility.

Both backends store the complete Community state: Better Auth identities and sessions, workspaces, products, connector configuration, normalized evidence, Agent conversations and runs, actions, missions, reports, schedules, and audit events.

## Vercel

Import the repository and add the environment variables. The committed `vercel.json` builds the D1 path with `npm run build:next`. For Supabase, change the project build command to `npm run build:supabase` or update that file in your deployment branch. Do not set both storage backends.

## AWS Amplify Hosting

Connect the repository in Amplify Hosting and add the environment variables. The provided `amplify.yml` uses D1 through `npm run build:next`; change its build command to `npm run build:supabase` when Supabase is the application store. Other AWS Next.js hosting products can use the same two build commands and the standalone output.

## Scheduled work on Node.js hosts

Cloudflare Workers execute `worker.ts` every 15 minutes from `wrangler.jsonc`. A Next.js deployment has no Worker scheduled handler, so configure the hosting platform or an external scheduler to send authenticated `POST` requests to both endpoints:

- `/api/cron/maintenance` processes due connector synchronizations, action outcomes, and Growth Missions;
- `/api/cron/reports` processes due report schedules.

Send `Authorization: Bearer <REPORT_CRON_SECRET>` and keep the same independent secret in the deployment environment. A 2xx response means the automation run completed without a task-level error; inspect the application automation ledger for partial or failed work. Do not expose either endpoint through a public unauthenticated scheduler.

## Database migrations

Apply the migration set for the chosen backend before starting the deployment. A successful application build does not apply production schema changes.

For D1, first confirm the production database name and UUID. The returned UUID must match `CLOUDFLARE_D1_DATABASE_ID`. List the migration state, apply the repository migrations, list again, and query critical tables in that same database:

```bash
npx wrangler d1 info dashloom-production --json
npx wrangler d1 migrations list dashloom-production --remote
npx wrangler d1 migrations apply dashloom-production --remote
npx wrangler d1 migrations list dashloom-production --remote
npx wrangler d1 execute dashloom-production --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workspaces','workspace_members','products','metric_points','analysis_runs','reports') ORDER BY name;"
```

The final migration list must show no pending entry and the critical tables must exist. A migration file in the repository is not proof that production was migrated.

For Supabase, copy the database connection string from the intended project's database settings, set `SUPABASE_DATABASE_URL` only in your secure shell or CI secret store, then run:

```bash
npm run db:migrate:supabase
```

The PostgreSQL migration set lives in `drizzle-supabase/`. Verify that all 38 application tables exist in the intended Supabase project before serving traffic. Never expose the database URL through a `NEXT_PUBLIC_*` variable.

## Supabase operational notes

The Supabase backend has its own PostgreSQL schema, migration journal, Better Auth dialect, pooled driver, transaction-backed batch adapter, and PostgreSQL JSON expressions. `npm run typecheck:supabase`, `npm test`, and `npm run build:supabase` validate this path without contacting a production database. Applying and verifying the migration against your selected project remains a deployment step.

Use `SUPABASE_DATABASE_POOL_SIZE` to cap each application instance at 1–20 connections (default `5`). `SUPABASE_DATABASE_SSL=disable` is available only for a trusted local or self-hosted Supabase installation without TLS; hosted Supabase should keep the secure default.

## Release verification

Run both type checks and both production builds before promoting a release:

```bash
npm run typecheck
npm run typecheck:supabase
npm run build:next
npm run build:supabase
```

Then verify sign-in, workspace language switching, one connector synchronization, one Agent run, and both authenticated cron endpoints against the selected backend.

## Production checklist and rollback

1. Confirm `BETTER_AUTH_URL` matches the final HTTPS origin and test sign-in and recovery.
2. Create a workspace and verify that the selected `DASHLOOM_DEFAULT_LOCALE` is applied only to new workspaces.
3. Run one connector synchronization and confirm evidence is stored in the selected backend.
4. Call both Cron endpoints with the production `REPORT_CRON_SECRET` and inspect the automation ledger.
5. Test export and one cited Agent run before announcing availability.

Back up the selected database before a risky migration; see the [backup and recovery guide](backup-and-recovery.md). If application verification fails, roll the hosting deployment back to its previous version. Do not manually delete tables or edit migration history. Database rollback requires a tested backup or provider recovery mechanism, followed by migration and schema verification.
