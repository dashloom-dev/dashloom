# Supabase operations setup

Dashloom imports project status and aggregated daily request counts from the Supabase Management API. It stores Auth, Realtime, REST, Storage, and combined API request totals plus a `1`/`0` project-health signal. It never reads database tables, Auth users, logs, API keys, project secrets, SQL, request paths, or payloads.

## Create least-privilege access

1. Prefer a Supabase OAuth or fine-grained token over a personal access token (PAT).
2. Grant only `projects_read` and `analytics_usage_read` to the project you want to connect.
3. If your account cannot create a fine-grained token, a PAT works, but it inherits your user privileges. Treat it as a high-value secret, rotate it periodically, and revoke it when no longer needed.
4. Copy the 20-letter project ref from **Project Settings → General**.

The connector calls only the fixed `https://api.supabase.com` origin and uses `GET /v1/projects/{ref}` plus `GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts?interval=1day`. The token is validated before it is encrypted and stored.

## Connect and synchronize

1. In Dashloom, open **Data sources → Supabase operations**.
2. Choose the Dashloom product represented by the Supabase project.
3. Enter a connection name, project ref, and access token.
4. Select **Connect Supabase**, then **Sync Supabase**.
5. To keep evidence current, add a Supabase schedule under **Automation**.

Each project ref is a separate workspace-scoped connector account, so one workspace can map multiple Supabase projects to different Dashloom products. Reconnecting the same ref updates its encrypted token and mapping.

The Management API determines the available usage history; Dashloom stores every valid daily period returned by the endpoint. A project is considered healthy only when Supabase returns `ACTIVE_HEALTHY`; other or unknown states are stored as `0` so the Operations Agent can flag the condition without inventing a cause.

Official references: [Management API authentication](https://supabase.com/docs/reference/api/introduction), [project endpoint](https://supabase.com/docs/reference/api/v1-get-a-project), and [usage API counts](https://supabase.com/docs/reference/api/v1-get-project-usage-api-count).
