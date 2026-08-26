# Backup and recovery runbook

Dashloom uses Cloudflare D1 as its system of record. Workspace JSON export supports customer portability; database backup and disaster recovery use D1 export and Time Travel.

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

## Restore drill

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
