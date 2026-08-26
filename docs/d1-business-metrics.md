# Connect Cloudflare D1 business metrics

Dashloom can turn aggregate rows from your own D1 database into normalized product metrics. Use this connector for signups, active users, subscriptions, revenue, refunds, or any other numeric signal that your application already stores.

## 1. Create a least-privilege token

In Cloudflare, create a custom API token with **Account / D1 / Read** for only the account that owns the database. Do not grant Write permission. Save the token once; Dashloom encrypts it and never displays it again.

Copy the Account ID and Database ID from the D1 overview. Each Dashloom connection represents one database, and multiple connections can coexist in a workspace.

## 2. Write an aggregate query

The query must return one ISO date column and one or more numeric columns. Keep the result bounded to the reporting window you need.

```sql
SELECT
  date(created_at) AS metric_date,
  count(*) AS signups,
  sum(case when plan = 'paid' then 1 else 0 end) AS paid_signups
FROM users
WHERE created_at >= datetime('now', '-14 days')
GROUP BY date(created_at)
ORDER BY metric_date
```

Set the date result column to `metric_date`, then map result columns to stable Dashloom metric names:

```json
{
  "signups": "signups",
  "paid_signups": "paid_signups"
}
```

Metric names may use letters, numbers, and underscores. A query can map up to 20 metrics and return up to 5,000 rows.

## 3. Connect and synchronize

Open **Dashboard → Data sources → Business metrics**, choose a product, enter the token and identifiers, then save the query. Select **Sync D1 metrics** to run every enabled mapping in the workspace.

Dashloom accepts a single `SELECT` or `WITH` statement, rejects SQL mutation and DDL syntax, and checks the D1 response for zero rows written. The token remains encrypted at rest and is only decrypted during server-side validation or synchronization.

## Troubleshooting

- **Authentication error:** confirm the token has D1 Read access to the selected account.
- **Invalid date rows:** return dates in `YYYY-MM-DD` format or a timestamp whose first ten characters use that format.
- **No metric points written:** verify mapped columns are numeric and their names exactly match the query aliases.
- **Too many rows:** aggregate by day and restrict the date range.

Reference: [Cloudflare D1 query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
