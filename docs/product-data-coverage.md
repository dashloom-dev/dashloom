# Product data coverage

The **Products** page is the source of truth for whether a Dashloom product is actually connected. Creating a product does not imply that a provider is mapped, and configuring an account does not imply that a successful synchronization has written evidence.

Each product card combines workspace-scoped connector mappings with stored metric aggregates. It reports source and metric-series counts, stored point count, latest evidence date, and the five specialist Agents that have matching evidence in their current 14-day interactive window. Competitor points count only when the competitor is explicitly attached to that product and its metric satisfies the same specialist policy.

## Coverage states

- **live:** at least one source wrote evidence within the last three UTC calendar days;
- **stale:** historical evidence exists, but no source is fresh within three days;
- **awaiting sync:** a connected, enabled mapping exists but has not written a metric point;
- **not connected:** the product has neither a mapping nor imported metric evidence.

Individual source chips may also show **attention** when a mapping exists but its account is pending, disabled, or needs repair. Evidence imported through the normalized API or manual import remains visible even when it has no connector mapping; freshness still comes from the stored metric date.

All queries include the active workspace boundary. The page reads aggregated evidence and never exposes connector credentials. It does not add sample products or demo metrics to a user workspace.

Use **Fix data coverage** to open Data sources, repair the account or mapping, run synchronization, and then return to Products to confirm a real evidence date. An Agent is enabled only after its own matching evidence is present; unrelated high-volume metrics cannot make another specialist appear ready.
