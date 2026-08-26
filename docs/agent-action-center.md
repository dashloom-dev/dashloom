# Agent Action Center

Dashloom Agent does more than produce a paragraph. Every contract-valid finding from interactive analysis, alerts, and daily, weekly, or monthly reports becomes an evidence-linked action in **Agent actions**.

## How actions are created

An action freezes the finding title, explanation, recommended next move, product scope, severity, confidence, evidence references, and source analysis run. Dashloom normalizes the product, title, and recommended action into a SHA-256 fingerprint. An exact recurring recommendation updates the existing action and increases its occurrence count instead of creating another card.

An append-only occurrence row is uniquely keyed by analysis run and finding position. Retries and historical backfills therefore cannot inflate recurrence counts. If action materialization fails, the analysis remains available and records a retryable repair code; **Import recent findings** can safely retry up to 100 validated historical runs at a time. Contract-incompatible historical runs are marked separately and are not retried forever.

Agent output may reference only product IDs and evidence IDs present in the frozen evidence bundle. Unknown products, invented citations, unlabeled causal claims, and undisclosed truncated evidence are rejected before findings or actions are stored.

## Workflow

Actions move through explicit states:

```text
suggested → planned → in progress → done
    └──────────────→ dismissed
done → in progress
dismissed → planned
```

Workspace owners, administrators, and members can assign an action to a current member, set a UTC due date, complete it, reopen it, or dismiss it with a reason. Viewers have read-only access. Every state update is compare-and-set to prevent overwriting a concurrent change and writes a workspace audit event.

Daily, weekly, monthly, and manual Agent reports include the five highest-priority open actions with status, recurrence count, and UTC deadline state. If an exact recommendation recurs after it was completed, Dashloom returns it to **suggested**; a deliberately dismissed recommendation remains dismissed until a member plans it again.

## Outcome follow-up

When a product-scoped action is moved to **done**, Dashloom resolves the metric and product from the source finding, follows its cited evidence back to the frozen analysis run, and stores the latest same-source daily measurement as an immutable completion baseline. Flow and ratio metrics use the latest completed UTC day so a partial current day is not compared with a full later day; stock metrics such as MRR may use the completion date. Workspace exports include every completion cycle and its measurements.

After later-dated metric evidence arrives, the scheduled maintenance loop and the **Refresh outcomes** control compare the new daily measurement with that baseline. Metrics with an explicit operating direction can be classified as improved or regressed; contextual metrics are reported only as changed or unchanged. Zero baselines do not produce a misleading percentage.

This is a temporal follow-up, not an experiment. Every result states that movement after completion does not prove the action caused it. Findings without a cited product metric remain visible as insufficient instead of being silently scored. Reopening and completing a recurring action creates another cycle rather than overwriting its earlier result.

The Action Center is a decision aid, not an autonomous operator. It does not deploy code, change infrastructure, spend money, contact customers, issue refunds, or modify connected providers. Inspect the linked frozen evidence before consequential work.
