# Calculated metrics

Dashloom can turn normalized source metrics into deterministic business metrics before the Agent analyzes them. Use this for conversion, revenue per customer, gross revenue after refunds, percentages, or unit normalization.

## Create a formula

Open **Data sources → Calculated metrics**. Owners and admins can define:

- a stable output metric such as `revenue_per_paid_user`;
- a left source and metric;
- add, subtract, multiply, or divide;
- either a second source metric or a numeric constant;
- an optional scale, such as `100` to express a ratio as a percentage.

A workspace can keep up to 50 definitions so synchronization work remains bounded.

For example, `stripe.revenue ÷ stripe.paid_users × 1` creates an amount per paid user. `ga4.conversions ÷ ga4.sessions × 100` creates a percentage.

## Alignment and safety

Dashloom aggregates each operand with its normal metric semantics, then aligns the operands by workspace, product, calendar date, and compatible currency. It skips ambiguous matches, division by zero, cross-currency arithmetic, and multiplication of two monetary operands. Formulas cannot depend on other calculated metrics, so dependency cycles are impossible, and they never execute user code.

Each result is stored as a normalized `metric_points` row with source `calculated` and the formula ID in its dimensions. Dashboards, alerts, reports, and Agent evidence can therefore use it through the same bounded data path as provider metrics.

## Refresh behavior

The active 30-day window is rebuilt after Cloudflare, Google, D1, Stripe, or Lemon Squeezy synchronization. A formula refresh failure is reported separately and does not turn a successful provider synchronization into a retry. Use **Recalculate** after changing source data outside those sync paths.

Deleting a formula also deletes its materialized calculated points. Workspace exports contain both definitions and calculated points; portable imports intentionally omit formula definitions because source naming and units must be reviewed in the destination workspace.
