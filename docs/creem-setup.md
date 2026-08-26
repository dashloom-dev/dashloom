# Creem revenue setup

Dashloom imports privacy-minimized commercial evidence from Creem for Revenue Agent analysis and recurring reports. It stores daily gross paid revenue, refunds, paid transaction counts, and chargeback counts by currency. It does not store customer IDs, names, email addresses, descriptions, tax countries, metadata, orders, or subscription identifiers.

## Create the connection

1. In the Creem dashboard, open **Developers → API Keys** and create a server API key.
2. In Dashloom, open **Data sources → Creem revenue**.
3. Select **Production** or **Test mode**. Creem isolates these environments and their keys.
4. Select the Dashloom product that owns the revenue.
5. Optionally enter a `prod_…` Creem Product ID to restrict the import. Leave it blank to import all products visible to that key.
6. Enter a connection name and the API key, then choose **Connect Creem**.
7. Choose **Sync Creem**, or create an automatic Creem schedule under **Automation**.

The key is validated only against the fixed `https://api.creem.io` or `https://test-api.creem.io` origin, encrypted before storage, and never returned by read APIs or workspace exports. Reconnecting the same key, environment, and product scope updates that connection; a different key or product scope creates another account mapping.

## Metric semantics

- `revenue` is gross `amount_paid` for paid and refunded commercial transactions, divided by 100.
- `refunds` is `refunded_amount`, reported separately rather than silently netted from revenue.
- `paid_transactions` counts paid commercial transactions.
- `chargebacks` counts chargeback-status transactions and is not treated as paid revenue.
- Currency is retained in metric dimensions. Dashloom never adds or directly compares different currencies.

Each sync reads the preceding 60 days plus the current day, with at most 1,000 transactions per connection. If that safety limit is reached, the sync run is marked `partial` and reports the truncation. No MRR is inferred from transactions because transaction history alone does not prove the current recurring subscription state.

Official references: [API introduction and environment isolation](https://docs.creem.io/api-reference/introduction) and [transaction search schema](https://docs.creem.io/api-reference/endpoint/get-transactions).
