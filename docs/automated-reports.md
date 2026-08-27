# Self-hosted reports

Community users can generate cited reports on demand or create daily, weekly, and monthly schedules. Scheduled runs use the workspace's connected BYOK provider, preserve product scope, and retry with a stable occurrence identity.

Cloudflare runs due reports from the Worker schedule. Node.js deployments must configure a scheduler to send an authenticated `POST` request to `/api/cron/reports` with `Authorization: Bearer <REPORT_CRON_SECRET>`.

Reports are stored in the selected application database. Hosted email, Slack, Discord, Telegram, webhook delivery, and managed alerting are not included in this repository.
