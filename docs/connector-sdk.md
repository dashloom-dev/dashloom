# Connector SDK and metric ingestion

Dashloom accepts normalized metrics from billing systems, product analytics, databases, scripts, and third-party connectors through a product- or workspace-scoped HTTP API.

If your service is easier to poll than to push from, use the [Custom REST metric contract](custom-rest-setup.md); both paths write the same normalized evidence layer.

## Create an ingestion key

For a normal single-product sender, open **Data sources → Direct product ingestion**. Choose the product, create its product-scoped key, copy the secret once, and use the generated server-side command. After sending a real aggregate, select **Verify connection** to confirm persisted evidence, key usage, and which specialist Agents have enough recent evidence.

Only trusted multi-product pipelines should create a workspace-wide key under **Settings → Extensibility**. Product-scoped keys cannot write another product, even when that product belongs to the same workspace. Dashloom stores only each key's SHA-256 hash. The plaintext cannot be recovered; revoke the key and create another if it is lost.

Keep the key in a server-side secret named `DASHLOOM_API_KEY`. Never expose it in browser code, a mobile application, logs, or source control.

## Send metrics

```bash
curl https://your-dashloom.example/api/ingest/v1/metrics \
  -H "Authorization: Bearer $DASHLOOM_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"rows":[{"productId":"PRODUCT_UUID","source":"billing","metric":"mrr","metricDate":"2026-08-26","value":1299,"dimensions":{"currency":"USD"}}]}'
```

Each request accepts 1–1000 rows. `productId` must belong to the token workspace and, for a product-scoped token, must equal its assigned product. Repeating the same workspace, product, source, metric, date, and dimensions updates the existing point instead of duplicating it.

The zero-dependency TypeScript client lives in [`sdk/typescript`](../sdk/typescript/README.md).

If the source is a D1 database in your own Cloudflare account, use the deployable [Cloudflare Connector Worker](../examples/cloudflare-connector-worker/README.md). It reads a fixed aggregate table through a D1 binding and sends only normalized metrics, so your Dashloom deployment never receives a D1 credential or arbitrary query access.

## Metric contract

- `source`: lowercase source identifier, such as `stripe`, `posthog`, or `custom_etl`.
- `metric`: lowercase semantic name, such as `mrr`, `active_users`, or `trial_conversion_rate`.
- `metricDate`: an ISO calendar date (`YYYY-MM-DD`) in the reporting timezone.
- `value`: a finite number. Keep units consistent across a metric.
- `dimensions`: up to 12 low-cardinality scalar fields with normalized keys and string values no longer than 120 characters. Raw identity, request, and secret keys such as `email`, `ip_address`, `user_id`, `customer_id`, `session_id`, `token`, and `request_body` are rejected.

Successful requests return the number of points written. Authentication, schema, and workspace-boundary failures return JSON errors and do not partially accept an invalid payload.
