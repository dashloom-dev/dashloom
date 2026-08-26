# Connect Stripe revenue evidence

Dashloom imports commercial evidence for one product from each Stripe account: daily gross revenue, daily refunds, current monthly recurring revenue (MRR), and current paid-customer count. Values are limited to the account default currency so different currencies are never silently added together.

## Create a restricted key

In **Stripe Dashboard → Developers → API keys → Restricted keys**, create a server-side key with read access to:

- Account details;
- Balance transactions;
- Subscriptions and subscription items.

Use a test restricted key first. Stripe recommends restricted keys and least privilege instead of sharing an unrestricted secret key. Never use a publishable key; it cannot read these resources.

## Connect and verify

1. Create the product in Dashloom.
2. Open **Data sources → Stripe revenue**.
3. Enter a connection name, choose the product, and paste the restricted key.
4. Select **Connect Stripe**. Dashloom verifies Account access, detects the account ID and default currency, encrypts the key with workspace-bound AES-GCM, and maps the account to the product.
5. Select **Sync Stripe**, or create a Stripe automatic synchronization schedule.
6. Open **SaaS Revenue Dashboard** or ask the **Revenue Analyst** about MRR, revenue, refunds, or paid customers.

Resubmitting the same Stripe account rotates its encrypted key and updates the product mapping. Dashloom caps pagination, records failures in synchronization history, and never returns the key through read APIs or workspace exports.

## Metric semantics

- `revenue`: gross successful commercial balance flows for each day;
- `refunds`: absolute refund flows for each day;
- `mrr`: latest active recurring subscription value normalized from daily, weekly, monthly, and yearly prices;
- `paid_customers`: distinct customers represented by active included subscriptions;
- `trialing_customers`: distinct customers on trial, kept separate from paid MRR.

MRR is a point-in-time operating estimate, not recognized accounting revenue. Metered and tiered prices without a fixed unit amount are excluded because their future monthly value is not knowable from the price alone. Stripe fees, payouts, transfers, taxes, foreign currencies, and unrelated balance movements are also excluded.

Official references: [Stripe key security](https://docs.stripe.com/keys-best-practices), [Balance transactions](https://docs.stripe.com/api/balance_transactions/list), and [Subscriptions](https://docs.stripe.com/api/subscriptions/list).
