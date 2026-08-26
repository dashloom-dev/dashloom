# Automatic synchronization

Community deployments run enabled connector schedules from the Worker's quarter-hourly Cron. Each schedule is claimed conditionally before provider work starts, records stable retry state, and advances using the workspace configuration.

Configure `REPORT_CRON_SECRET` for authenticated manual maintenance and keep connector credentials encrypted in D1. Data retention is controlled by the self-hosting operator's backup and database policies; this repository does not run a managed retention service.
