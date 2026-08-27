# Backup and recovery runbook

Dashloom stores its complete application state in the backend selected for the deployment: Cloudflare D1 or Supabase PostgreSQL. Workspace JSON export supports customer portability, but it is not a complete operational backup. Back up and restore the selected database independently.

## Cloudflare D1

## Before a risky change

1. Confirm the production database name and UUID with `npx wrangler d1 info site-creator-d1 --json`.
2. Export an independent SQL copy:

```bash
npx wrangler d1 export site-creator-d1 --remote --output backups/dashloom-YYYY-MM-DD.sql
```

3. Record a Time Travel bookmark for the change timestamp:

```bash
npx wrangler d1 time-travel info site-creator-d1 --timestamp 2026-08-26T10:00:00Z --json
```

4. Store the export outside the application deployment with restricted access. It may contain encrypted credentials, user identifiers, and customer metrics.

### D1 restore drill

Run drills against a separate test database whenever possible. A production Time Travel restore overwrites the active database in place.

```bash
npx wrangler d1 time-travel restore site-creator-d1 --bookmark BOOKMARK
```

After a restore:

1. Save the `previous_bookmark` returned by Cloudflare so the restore can be undone.
2. Run `npm run db:status:local` only for local state; for production, run `npx wrangler d1 migrations list site-creator-d1 --remote`.
3. Apply any migrations newer than the restore point with `npx wrangler d1 migrations apply site-creator-d1 --remote`.
4. Confirm no migration remains and query critical tables: `workspaces`, `workspace_members`, `products`, `metric_points`, `analysis_runs`, `agent_comparison_runs`, `agent_comparison_results`, `reports`, and `billing_subscriptions`.
5. Test sign-in, one read-only dashboard, one connector sync, one Agent run, and one report delivery.
6. Record recovery point, recovery duration, verifier, and any missing data.

Cloudflare currently documents Time Travel for the production storage subsystem and exposes both bookmark/timestamp restore and a `previous_bookmark` for undo. Review the [current D1 Time Travel CLI](https://developers.cloudflare.com/workers/wrangler/commands/d1/) and [restore API](https://developers.cloudflare.com/api/resources/d1/subresources/database/subresources/time_travel/methods/restore/) before every production drill.

## Supabase PostgreSQL

Before a risky change, confirm the intended Supabase project and review its available backup window under **Database → Backups**. Paid projects provide managed daily backups, with Point-in-Time Recovery available separately; operators of projects without the required managed retention should create and store an independent logical dump. Follow Supabase's current [database backup policy](https://supabase.com/docs/guides/platform/backups) and [CLI backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Prefer restoring into a separate project for a drill. An in-place restore makes the project unavailable during the operation and overwrites database state. After any restore:

1. Reapply newer files from `drizzle-supabase/` with `npm run db:migrate:supabase`.
2. Verify all 38 Dashloom application tables in the intended project.
3. Confirm the deployment's `SUPABASE_DATABASE_URL` still targets the restored project and keep it server-only.
4. Test sign-in, one dashboard read, one connector synchronization, one Agent run, and one report run.
5. Record the recovery point, recovery duration, verifier, missing data, and any credential rotation required by the restore method.

Supabase database backups do not represent external provider data or connector credentials held outside Dashloom. Restoring Dashloom also does not revoke or roll back credentials at Google, Bing, payment providers, or other connected systems.
