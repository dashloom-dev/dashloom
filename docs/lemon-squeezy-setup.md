# Lemon Squeezy revenue setup

Dashloom imports recent order revenue and refunds plus current subscription MRR, paid customers, and trialing customers from one Lemon Squeezy Store. Every Store connection maps to one Dashloom product.

## Create and connect the credential

1. In Lemon Squeezy, open **Settings → API** and create an API key. Live and test keys are separate and expire according to Lemon Squeezy's policy.
2. Find the numeric Store ID in the Lemon Squeezy dashboard or API.
3. In Dashloom, create the target product first.
4. Open **Data sources → Lemon Squeezy revenue**.
5. Enter a connection name, product, Store ID, and API key, then select **Connect Lemon Squeezy**.
6. Run the first synchronization or create an automatic schedule.

The key is validated against the fixed `https://api.lemonsqueezy.com` origin and encrypted before storage. It is never returned by read APIs or exported.

## Imported evidence

- `revenue` and `refunds` by order date and order currency for the latest 14 days;
- `mrr` in the Store currency from standard, non-usage-based active subscription prices;
- `paid_customers`, including cancelled subscriptions still in their grace period;
- `trialing_customers` from `on_trial` subscriptions.

Test-mode orders and subscriptions are excluded. Pending, failed, and fraudulent orders are not counted. Different order currencies remain separate in dashboards and Agent evidence. Usage-based subscriptions are excluded from MRR because current usage is not a stable recurring commitment.

Dashloom reads at most 1,000 rows per paginated collection and resolves at most 100 distinct active prices per sync. If a Store exceeds these safety bounds, use a narrower integration through the Connector SDK until an expanded high-volume connector is available.

Official references: [API request and authentication rules](https://docs.lemonsqueezy.com/api/getting-started/requests), [orders](https://docs.lemonsqueezy.com/api/orders/the-order-object), [subscriptions](https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object), and [prices](https://docs.lemonsqueezy.com/api/prices/the-price-object).
