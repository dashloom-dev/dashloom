# Product operating goals

Product goals let an operator define what success means before asking an Agent for advice. Dashloom then evaluates each target from stored metric data and freezes the result into eligible Agent runs.

## Create a goal

Open **Products → Operating targets**. Choose a product and enter:

- a normalized metric such as `revenue`, `mrr`, `sessions`, `clicks`, or `error_rate`;
- an optional source, when the target must use only one connector;
- an optional ISO currency, which prevents monetary evidence from different currencies being combined;
- `at least` for growth targets or `at most` for budgets and risk limits;
- a rolling daily, weekly, monthly, or quarterly period;
- the target value.

Only workspace owners and admins can create, pause, enable, or delete shared goals. All changes are audited.

## How progress is calculated

Rolling periods contain 1, 7, 30, or 90 inclusive calendar days ending on the data date. Dashloom uses the metric's deterministic rollup policy:

- counters such as revenue, sessions, and requests are summed;
- snapshots such as MRR and paid customers use the latest value;
- rates such as CTR, churn, and error rate are averaged.

Goal status is `achieved`, `at risk`, `off track`, or `no data`. This status is calculated before any model call.

## Agent evidence

An enabled goal becomes an evidence record such as `goal:<goal-id>` when its metric is allowed for the selected specialist. Goal names are treated as untrusted data. The Agent may cite the record to discuss target attainment, but cannot redefine the target, manufacture progress, or use a goal as proof of causality.

Historical analysis remains reproducible because the evaluated target, period, current value, progress, and status are frozen with the run. Workspace exports include goal definitions; portable imports remap them to matching products and strip historical private analysis.
