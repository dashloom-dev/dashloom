# Agent-generated smart dashboards

Dashloom can turn any successful Agent analysis into a reusable smart dashboard. This connects the product's evidence, specialist analysis, dashboard, action, and reporting layers without asking the model to invent chart data.

## Create a smart dashboard

1. Connect real product data and a BYOK or managed model.
2. Open **Agent**, choose one of the five specialists, and run an analysis.
3. Review the cited findings, then select **Create smart dashboard**.
4. Dashloom opens a saved view based on the matching decision template.

Repeated requests for the same analysis return the existing view. They do not create duplicates.

## What the Agent controls

The selected specialist determines the base view:

- Portfolio Analyst → Indie Hacker Dashboard;
- Revenue Analyst → SaaS Revenue Dashboard;
- SEO Growth Analyst → SEO Growth Dashboard;
- Operations Analyst → Cloudflare Operations Dashboard;
- Client Reporting Analyst → Agency Client Dashboard.

Valid metric names cited by the findings are placed first, followed by safe template defaults up to the eight-metric limit. Dashloom applies a one-product scope only when every finding is product scoped and points to the same product. Otherwise, the view stays portfolio scoped.

## Evidence behavior

The Agent briefing is a stored conclusion tied to the exact successful analysis run. Its finding cards preserve confidence, next action, and evidence references. The metric cards and evidence table continue to read current normalized workspace evidence, so users can distinguish a historical conclusion from live movement.

The **Inspect frozen evidence** link opens the immutable analysis snapshot used by the model. If retention later removes that analysis, the ordinary dashboard remains usable but no longer displays the Agent briefing.

## Sharing boundary

Private dashboard links expose only the selected product scope, selected normalized metrics, and current metric evidence. They intentionally exclude the internal Agent briefing because its natural-language summary may mention workspace context outside the saved metric scope. Use a client report when a reviewed narrative must be delivered externally.
