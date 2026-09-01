# Understand a product's data status

Each card on **Products** tells you whether data is connected, when it was last updated, and which Agents can use it. Start here when an Agent is unavailable or a product looks out of date.

## The four product states

- **live:** at least one source wrote data during the last three UTC calendar days;
- **stale:** historical data exists, but nothing has updated during the last three days;
- **awaiting sync:** a healthy source is mapped to the product, but no metrics have been imported yet;
- **not connected:** the product has no source mapping and no imported metrics.

A source can also show **attention** when its account is unfinished, disabled, or needs repair.

## Fix a product that is not live

1. Select **Fix data coverage** on the product card.
2. Check that the source account is enabled, its credential is valid, and the correct resource is mapped to this product.
3. Run a manual sync.
4. Return to **Products** and confirm that the data-point count and latest date changed.
5. Open Agent again and check that the matching analyst is now available.

## Why “connected” is not enough

Saving a token or completing OAuth only gives Dashloom permission to read. The system cannot analyze anything until a sync writes metrics, so the status uses saved data dates instead of setup clicks.

The card also shows source count, metric-series count, data-point count, and available Agents. Data pushed through the Metrics API or imported manually still counts even when it has no connector account.

## Why only some Agents are available

Each Agent uses data that matches its job. Revenue needs revenue metrics, SEO needs search data, and Operations needs runtime or deployment data. A large volume of unrelated metrics does not enable every Agent.

Every query is limited to the current workspace and product. The status page reads aggregated metrics only; it does not expose connector secrets or add demo products.
