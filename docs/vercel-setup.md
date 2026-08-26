# Connect Vercel deployment health

Dashloom connects recent Vercel deployment outcomes to a product so the Operations and Portfolio Agents can compare delivery activity with traffic, revenue, and runtime evidence. It reads project metadata and deployment summaries only; it does not read environment variables, source files, build logs, or deployment file contents.

## Create access

1. Open **Vercel account settings → Tokens** and create an Access Token with an expiration date.
2. Scope it to the personal account or Team that owns the project.
3. For a Team project, copy the Team ID from the Team's general settings.
4. Copy the project ID or exact project name.

Vercel requires the Team ID query parameter when accessing Team-owned resources. A missing or mismatched Team ID typically returns 403 even when the token itself is valid.

## Connect and synchronize

Open **Dashboard → Data sources → Vercel deployment health**. Select a Dashloom product, enter the project, optional Team ID, and Access Token, then connect. The token is validated against the read-only project endpoint before it is encrypted.

Manual and scheduled synchronization import the recent 30-day window:

- total, successful, failed, canceled, and production deployment counts by day;
- average ready duration for deployments that expose both creation and ready timestamps;
- whether the latest completed deployment succeeded;
- days since the latest deployment.

Collection is bounded to 300 deployments per project per sync. The response marks a truncated result explicitly. Dashloom does not claim that deployment duration is request latency or end-user performance.

## Troubleshooting

- **403:** verify the token scope and Team ID.
- **404:** verify the project ID/name and the selected account scope.
- **429:** wait until the rate-limit reset time returned by Vercel.
- **No duration:** Vercel did not expose a valid ready timestamp for those deployment summaries; outcome counts still synchronize.

Reconnect the same Vercel account to rotate its encrypted token.
