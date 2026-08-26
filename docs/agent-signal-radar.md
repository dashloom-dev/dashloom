# Agent Signal Radar

Agent Signal Radar is Dashloom's live decision queue. It scans the aggregate evidence already stored for real products, compares two complete seven-day windows, and ranks the changes that may deserve attention before a model is called.

## What appears in the radar

- material metric changes of at least 10%;
- product health scores in `watch` or `risk` state;
- operating goals that are off track, at risk, or missing matching evidence;
- Growth Missions that are off track, missed, or have insufficient evidence;
- cross-domain signals moving together or diverging for the same product.

Every item preserves its product, source, metric, currency, latest evidence date, and evidence reference. Monetary series remain separated by currency. The current partial day is excluded from scheduled-style comparison windows so incomplete flow metrics do not become false regressions.

## Deterministic detection, optional AI

The radar does not use an LLM to decide that a change happened. Metric rollups, change percentages, goal progress, mission progress, health scores, specialist routing, and priority order are calculated by Dashloom.

Select **Analyze signal** to explicitly call the most relevant ready specialist:

- Revenue Analyst for commercial signals;
- SEO Growth Analyst for acquisition and search signals;
- Operations Analyst for delivery and infrastructure signals;
- Portfolio Analyst for product-specific or cross-domain signals.

The selected Agent receives a fresh bounded evidence snapshot. Its answer must cite the radar item's current evidence and distinguish observed movement from hypotheses about cause. If the preferred specialist does not have matching evidence, Dashloom falls back to the Portfolio Analyst when it is ready.

## Activate the radar with real data

1. Create the product you actually operate under **Products**.
2. Map a supported account under **Data sources**, or use the normalized ingestion API.
3. Run synchronization and verify that the product reports a recent evidence date.
4. Open **Signal radar** after enough history exists for both comparison windows.
5. Investigate a ranked item, turn the cited recommendation into an Agent Action, and approve a Growth Mission when a measurable target is appropriate.

An empty radar is explicit: Dashloom shows whether no product is connected, no comparable series exists, or no movement crossed the materiality threshold. It never inserts demo metrics into a workspace.

## Interpretation limits

Radar order is prioritization support, not proof of business impact. A large percentage can come from a small baseline. Cross-signal movement is correlation, not causation. Health is a deterministic operational summary, while goals and missions are operator-defined targets. Review the cited evidence and business context before acting.
