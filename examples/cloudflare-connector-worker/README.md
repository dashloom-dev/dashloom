# Dashloom Cloudflare Connector Worker

This standalone Worker reads a fixed, aggregate-only table from a D1 database in your own Cloudflare account and pushes normalized metrics to Dashloom on an hourly Cron Trigger. Dashloom receives the aggregate evidence, but it never receives your D1 API token, database credential, raw events, or query access.

## Data path

```text
Your application → dashloom_metrics_daily in your D1
                                  ↓ D1 binding, fixed SELECT
                    Connector Worker in your account
                                  ↓ HTTPS + workspace ingestion key
                          Your Dashloom deployment
```

The Worker accepts at most 1,000 aggregate rows per run, a one-to-seven-day lookback, ten user dimensions per point, and scalar low-cardinality dimension values. It rejects common raw identity, request, and secret fields. The source table should never contain email addresses, IP addresses, customer or user identifiers, request bodies, tokens, or raw event payloads.

## Configure

1. Copy this directory into its own project and run `npm install`.
2. In Dashloom, create the target product. Open **Settings → Extensibility**, create an ingestion key, and copy it once.
3. Edit `wrangler.jsonc`:
   - replace `DASHLOOM_URL` with the HTTPS origin of your Dashloom deployment;
   - replace `DASHLOOM_PRODUCT_ID` with the product UUID;
   - choose a normalized `SOURCE_NAME`;
   - replace the D1 database name and ID with the database in your Cloudflare account.
4. Create the aggregate contract in your D1 database, then populate it with real aggregates produced by your application. The SQL file intentionally inserts no sample metric:

   ```bash
   npx wrangler d1 execute YOUR_DATABASE --remote --file source-contract.sql
   ```

5. Store the Dashloom ingestion key as a Worker Secret. Do not paste it into `wrangler.jsonc`:

   ```bash
   npx wrangler secret put DASHLOOM_API_KEY
   ```

6. Generate binding types and validate without deploying:

   ```bash
   npm run types
   npm run check
   ```

7. Deploy with `npm run deploy`. The default Cron runs at minute 7 every hour. Adjust `triggers.crons` if needed.

## Local verification

Create an ignored `.dev.vars` containing a local ingestion key, prepare the local D1 table, then run `npm run dev`. Wrangler exposes the scheduled-test endpoint when `--test-scheduled` is enabled. `GET /health` returns only the connector mode and never returns configuration or secrets.

Structured logs contain only the event name, date range, row count, scheduled timestamp, or stable error code. Provider response bodies and credentials are never logged.

## Operational behavior

- The fixed query reads only `dashloom_metrics_daily` through a D1 binding.
- Re-sending the lookback window is safe because Dashloom upserts by workspace, product, source, metric, date, and dimensions.
- An invalid row fails the entire run instead of silently sending partial evidence.
- A non-2xx Dashloom response fails the Cron invocation so it appears in Cloudflare Cron history.
- The public Worker surface contains only `GET /health`; there is no unauthenticated manual-sync endpoint.
