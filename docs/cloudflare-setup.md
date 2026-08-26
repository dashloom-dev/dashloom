# Connect Cloudflare Analytics

Dashloom reads Worker runtime signals plus R2 request, error, storage, object, and pending-upload signals through Cloudflare's GraphQL Analytics API. Each workspace can connect more than one Cloudflare account. A product can map one Worker and one R2 analytics bucket independently.

## Create a least-privilege token

1. Open **Cloudflare Dashboard → Manage Account → Account API Tokens**.
2. Select **Create Token → Custom token**.
3. Give the token a descriptive name such as `Dashloom analytics`.
4. Add **Account → Account Analytics → Read**. To let Dashloom list Worker names automatically, also add **Account → Workers Scripts → Read**; this second permission is optional when you enter the name manually.
5. Under Account Resources, select only the account Dashloom should analyze.
6. Optionally add a TTL and client IP restrictions that match your deployment.
7. Create and copy the token. Cloudflare shows it once.

Official reference: [Configure an Analytics API token](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/).

## Find the Account ID and Worker name

Open the target Cloudflare account. Its Account ID appears in the account overview and in Worker settings. After entering the Account ID and token, select **Discover Workers** to populate the Worker-name field. If the token intentionally omits Workers Scripts Read, enter the deployed name shown under **Workers & Pages** manually; it is not the custom domain.

## Connect it in Dashloom

1. Create the product in **Products** first.
2. Open **Data sources → Cloudflare Operations**.
3. Enter a connection name, Account ID, API token, and product. Discover and choose the Worker, or enter its script name manually.
4. Select **Connect Worker**. Dashloom verifies both the token and account before storing the token with AES-GCM encryption.
5. Select **Sync connected accounts** to refresh the preceding 60 days plus today in provider-compliant chunks.

Submitting a different Account ID creates another connection. Submitting an existing Account ID rotates that connection's stored token. Mapping a product again replaces its previous Cloudflare Worker mapping.

## Connect an R2 bucket

1. Open **Data sources → Cloudflare R2**.
2. Use the same Account ID and an **Account Analytics → Read** token. Workers Scripts Read is not required for R2.
3. Enter the analytics bucket name. For a jurisdiction-restricted bucket, include the prefix required by Cloudflare, such as `eu_bucket-name`.
4. Map the bucket to a Dashloom product and select **Connect R2**.
5. Run **Sync R2** or create a separate Cloudflare R2 schedule under **Automation**.

Dashloom queries `r2OperationsAdaptiveGroups` and `r2StorageAdaptiveGroups`. It stores daily requests and errors plus payload bytes, metadata bytes, object count, and pending multipart uploads only when Cloudflare returns a storage snapshot. It never reads object names, bodies, keys, or bucket contents.

Cloudflare retains R2 analytics for only 31 days. Every R2 metric is marked with provider-limited coverage, so monthly Agent reports must disclose that a complete previous 30-day comparison is unavailable. Official reference: [R2 metrics and analytics](https://developers.cloudflare.com/r2/platform/metrics-analytics/).

## Verify the result

- The Cloudflare source card should show the configured account count.
- **Cloudflare Operations Dashboard** should show requests, errors, subrequests, and CPU evidence.
- **Overview** should show the sync run and metric totals.
- **Dashloom Agent** should count the imported points in its evidence context.

Dashloom treats Cloudflare Adaptive Analytics values as analytics estimates. It records the source and collection time and does not present them as billing records.

## Troubleshooting

- `HTTP 401/403` during synchronization: verify the token, account resource scope, and **Account Analytics: Read** permission.
- `Worker discovery returned HTTP 403`: add **Workers Scripts: Read**, or keep the narrower analytics-only token and enter the Worker name manually.
- `Account access returned HTTP 404`: the Account ID is incorrect or excluded from the token resource scope.
- GraphQL field or availability error: the dataset may not be available for the account plan; the sync run stores the returned error.
- No Worker rows: confirm the script name exactly matches the deployed Worker and that it received traffic during the synchronized period.
- No R2 storage rows: confirm the bucket name, including any jurisdiction prefix. Dashloom does not turn a missing storage snapshot into a zero-byte bucket.

Never commit the token to `.dev.vars`, `wrangler.jsonc`, documentation, screenshots, issues, or chat messages. Enter it only in the authenticated Dashloom settings surface.
