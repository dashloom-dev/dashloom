# Custom REST metrics

Custom REST lets Dashloom pull product KPIs from an HTTPS endpoint you control. Use it when a metric does not come from a built-in connector and you prefer scheduled pull over the normalized ingestion API.

## 1. Publish the contract

Expose a `GET` endpoint that returns `application/json` using contract version 1:

```json
{
  "version": 1,
  "truncated": false,
  "metrics": [
    {
      "metric": "trial_signups",
      "date": "2026-08-25",
      "value": 12,
      "unit": "users",
      "domain": "commercial",
      "dimensions": {
        "plan": "studio"
      }
    },
    {
      "metric": "activation_rate",
      "date": "2026-08-25",
      "value": 34.7,
      "unit": "percent"
    }
  ]
}
```

Rules:

- `metric` uses lowercase letters, numbers, and underscores, starts with a letter, and is at most 80 characters;
- `date` is a real UTC calendar date in `YYYY-MM-DD` format;
- future dates are rejected so they cannot distort later comparison windows;
- `value` is a finite JSON number;
- `unit` is optional and should stay stable for that metric;
- `domain` is optional and routes an unknown custom metric to the relevant specialist Agent: `commercial`, `acquisition`, `search`, `delivery`, `operations`, or `product`;
- dimensions are optional, use lowercase keys, and are limited to 12 bounded scalar values;
- one response contains 1–500 metrics and must remain under 1 MiB.
- set top-level `truncated` to `true` when the endpoint cannot include its complete intended period; the Agent will disclose partial coverage instead of treating absent records as zero.

Use stock-like names such as `paid_users`, `subscribers`, or `*_rate` consistently. Dashloom applies deterministic rollup semantics before sending evidence to the Agent.

For monetary metrics, include a three-letter currency in dimensions, for example `"dimensions": { "currency": "USD" }`. Never combine currencies into one value.

## 2. Protect the endpoint

Dashloom supports:

- no authentication;
- an `Authorization: Bearer …` token;
- one custom `X-…` API-key header.

Create a read-only, Dashloom-specific credential. Do not reuse an administrator or database credential. The endpoint URL cannot contain query parameters, fragments, embedded usernames, or passwords.

The connector validates public DNS before every call, rejects private and reserved destinations, follows no redirects, uses a 15-second timeout, and accepts only JSON responses under 1 MiB. Credentials are encrypted server-side and never returned by read APIs or workspace exports.

## 3. Connect and synchronize

1. Create the destination product in **Products**.
2. Open **Data sources → Custom REST metrics**.
3. Enter a connection name, product, endpoint URL, and authentication method.
4. Select **Connect endpoint**. Dashloom calls the endpoint once to validate the contract before saving the connection.
5. Select **Sync Custom REST** to write the first real metric points.
6. Under **Automatic synchronization**, select **Custom REST metrics** and a frequency allowed by the workspace plan.

Each endpoint is mapped to one product at connection time, and a product may use multiple endpoints. Metric identity includes the connection fingerprint, so two custom sources cannot overwrite each other accidentally. Disable removes the stored credential while retaining historical metric data. Successful values flow through the same dashboard, calculated-metric, alert, report, and Agent evidence layers as built-in connectors.

## Troubleshooting

- **Must use HTTPS / private destination:** publish the endpoint on a public HTTPS hostname. Localhost, private IPs, link-local addresses, and DNS names resolving to them are rejected.
- **Contract v1 error:** validate the response against the example and check the first reported field error.
- **HTTP 401 or 403:** rotate the dedicated token or confirm the custom header name and value.
- **Response too large:** return only normalized daily aggregates needed by Dashloom; do not return raw events or customer records.
- **Timeout:** pre-aggregate metrics in your service so the endpoint responds within 15 seconds.
- **Attention status after a previous success:** fix the endpoint, then run a manual sync. Successful synchronization restores the connected status.

Dashloom intentionally does not execute arbitrary scripts, JSONPath expressions, or transformation code from a remote response. Transform source data inside the service you control, or use the [Connector SDK](connector-sdk.md) for a richer integration.
