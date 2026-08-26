# Polar revenue setup

Dashloom imports privacy-minimized commercial evidence from Polar for Revenue Agent analysis and recurring reports. It stores daily net order revenue, refunded amount, and paid transaction count by currency. It never stores customer IDs, names, email addresses, billing addresses, descriptions, metadata, invoice numbers, checkout IDs, subscription IDs, or order IDs.

## Create the token

1. In Polar, open your organization settings and create an Organization Access Token.
2. Grant only `orders:read`. Dashloom does not need product, customer, subscription, refund-write, or organization-write permissions.
3. Choose whether the token belongs to **Production** or **Sandbox**. Polar isolates their data, users, tokens, and organizations.
4. Optionally copy a Polar Product ID if one Dashloom product should receive only that product's orders.

## Connect and synchronize

1. Open **Data sources → Polar revenue** in Dashloom.
2. Select the Dashloom product and matching environment.
3. Enter a connection name, the Organization Access Token, and optionally a Polar Product ID.
4. Select **Connect Polar**, then **Sync Polar**, or create a Polar schedule under **Automation**.

Tokens are validated only against the fixed `https://api.polar.sh/v1` or `https://sandbox-api.polar.sh/v1` origin and encrypted before storage. A token fingerprint, environment, and optional product scope identify each workspace connection, so multiple Polar organizations or product scopes can coexist.

Dashloom reads at most 1,000 newest orders and filters them to the preceding 60 days plus today. When more pages remain, the synchronization is marked partial and Agent evidence is marked truncated; the Agent must disclose incomplete coverage rather than interpret missing orders as zero.

Revenue uses Polar's `net_amount` (after discounts, before tax); refunds use `refunded_amount`. Currency values are never silently combined.

Official references: [API authentication and environment isolation](https://polar.sh/docs/api-reference/introduction), [list orders and pagination](https://polar.sh/docs/api-reference/orders/list), and [order amount semantics](https://polar.sh/docs/api-reference/orders/get).
