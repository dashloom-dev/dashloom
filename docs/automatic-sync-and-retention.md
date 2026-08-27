# Automatic synchronization

Enabled connector schedules use the same workspace-scoped runner on every deployment path. A schedule is claimed conditionally before provider work starts, records stable retry state, and advances from the workspace configuration. Failed runs use bounded exponential backoff.

On Cloudflare, the Worker scheduled handler runs every 15 minutes. On Vercel, AWS, or another Node.js host, configure a scheduler to send an authenticated `POST` request to `/api/cron/maintenance` with `Authorization: Bearer <REPORT_CRON_SECRET>`. The endpoint processes due connector schedules, action outcomes, and Growth Missions.

Connector credentials remain encrypted in the selected application database: D1 or Supabase PostgreSQL. Data retention is controlled by the self-hosting operator's backup and database policies; this repository does not run a managed retention service.
