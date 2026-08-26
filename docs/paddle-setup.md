# Paddle Billing revenue setup

Dashloom converts Paddle Billing financial records into currency-separated daily evidence for the SaaS Revenue Agent. It uses read-only server API access and never stores customer, address, invoice, item, checkout, or transaction identities.

## 1. Create a least-privilege key

In Paddle, open **Developer tools → Authentication → API keys** and create a server API key with only:

- `transaction.read`;
- `adjustment.read`.

Set an expiry date and rotate the key regularly. Do not use a Paddle.js client-side token. Choose the same environment in Dashloom as the key: **Production** for `pdl_live_…` or **Sandbox** for `pdl_sdbx_…`.

## 2. Connect the seller account

Open **Data sources → Paddle Billing revenue**, select the Dashloom product that owns the seller-level revenue, choose the environment, and paste the API key. Dashloom validates both permissions before encrypting the key. The browser never receives the stored key again.

One Paddle seller connection maps to one Dashloom product. To split a seller account across products, expose already-aggregated product-specific evidence through Custom REST or the authenticated ingestion API instead of copying customer or transaction records.

## 3. Synchronize evidence

Run **Sync Paddle** once, then optionally create a Paddle automatic schedule. Dashloom requests API version 1, follows Paddle's returned cursor URLs only on the fixed Paddle origin, and marks the run partial if the bounded history scan is exhausted.

Stored daily metrics are:

- completed transaction revenue from `details.totals.grand_total`;
- completed paid transaction count;
- completed subscription-linked transaction count;
- approved refunds;
- approved chargebacks and chargeback reversals.

Money stays separated by ISO currency, including zero-decimal currency handling. Pending or rejected refunds, draft/ready/billed/paid-but-not-completed transactions, customer fields, free-form metadata, and provider entity IDs are not stored.

Official references: [authentication and API-key permissions](https://developer.paddle.com/api-reference/about/authentication), [transactions](https://developer.paddle.com/api-reference/transactions/list-transactions), [adjustments](https://developer.paddle.com/api-reference/adjustments/list-adjustments), and [cursor pagination](https://developer.paddle.com/api-reference/about/pagination).
