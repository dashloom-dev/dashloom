# Dashloom product strategy

## Positioning

Dashloom is an open-source AI product intelligence platform for people operating one or more digital products.

It connects operational, acquisition, search, revenue, and competitor signals; turns those signals into a trustworthy evidence layer; and uses specialized agents to explain change, identify opportunities, and deliver recurring reports.

The product is not a generic chatbot placed beside a dashboard. Its durable advantage is the combination of normalized first-party data, historical context, purpose-built dashboard views, evidence-linked analysis, and recurring delivery.

## Product loop

```text
Connect data
    -> normalize and validate
    -> calculate deterministic metrics
    -> detect changes and anomalies
    -> assemble an evidence bundle
    -> run the appropriate analysis agent
    -> produce insights and recommended actions
    -> render a dashboard or report
    -> deliver to the selected channel
    -> measure what changed next
```

LLMs explain and synthesize; they do not become the source of truth for revenue, traffic, ranking, or operational calculations. Every material conclusion should link back to metrics, periods, products, and sources.

## Dashboard editions

| Dashboard | Primary user | Core signals | Default agent |
| --- | --- | --- | --- |
| Indie Hacker Dashboard | Solo builders with a portfolio | Product health, traffic, revenue, operations | Portfolio Analyst |
| SaaS Revenue Dashboard | Subscription SaaS teams | MRR, ARR, churn, retention, expansion | Revenue Analyst |
| SEO Growth Dashboard | Search-led products | Queries, pages, rankings, traffic, competitors | SEO Growth Analyst |
| Cloudflare Operations Dashboard | Cloudflare product teams | Requests, errors, latency, Workers, D1 | Operations Analyst |
| Agency Client Dashboard | Agencies and studios | Client KPIs, delivery status, anomalies, reports | Client Reporting Analyst |

Dashboards are presets over the same workspace data model, not separate products. A workspace can enable multiple views without importing the same data twice.

## Agent capabilities

Agents are scoped by workspace, role, allowed data, model provider, and usage policy. Initial capabilities:

1. Explain material changes between two periods.
2. Compare products and rank opportunities or risks.
3. Compare approved competitor signals with first-party performance.
4. Analyze revenue movement using server-calculated metrics.
5. Find SEO query, page, CTR, and ranking opportunities.
6. Detect operational anomalies and data freshness problems.
7. Answer conversational questions with evidence references.
8. Generate daily, weekly, and monthly reports.
9. Deliver reports through email, Slack, Discord, or webhooks.

Agent skills must declare required sources, supported metrics, output schema, permission scope, and evaluation cases. Imported text is treated as untrusted data and cannot change agent instructions or authorize external actions.

## Open-source and cloud boundary

### Community

- Self-hosted core and all five dashboard presets.
- Bring-your-own OpenAI-compatible API endpoint, key, and model.
- Credentials encrypted and used only on the server.
- Manual analysis and self-managed schedules.
- Community connector and agent-skill SDKs.

### Dashloom Cloud

- Managed data synchronization and infrastructure.
- Managed AI usage with plan-based daily allowances.
- Automatic daily, weekly, and monthly reports.
- Delivery channels, alerts, retries, monitoring, and retention.
- Collaboration, agency workflows, and support.
- Optional BYOK for teams that prefer their own provider agreement.

The commercial value is managed reliability and ongoing analysis, not removing core dashboards from the open-source edition.

## Entitlement model

Managed AI usage is enforced server-side. Plan definitions live in a versioned server catalog; append-only usage events record the workspace, model, run, token counts, and estimated cost. The browser may display remaining allowance but cannot grant it.

Suggested validation targets—not final published prices or quotas:

| Plan | Managed AI | Reports | Best fit |
| --- | --- | --- | --- |
| Community | BYOK | Self-managed | Developers and evaluators |
| Free Cloud | Small daily chat allowance | Weekly summary | Product discovery |
| Solo | Larger daily allowance | Daily and weekly | Independent builders |
| Studio | Shared workspace allowance | Daily, weekly, monthly | Small product teams |
| Agency | Pooled/client-scoped allowance | White-label/client delivery | Agencies |

Quotas should be tested against activation, retention, gross margin, and abuse—not chosen only as marketing numbers.

## Trust and safety requirements

- Never send an entire database to a model. Build bounded, minimal evidence bundles.
- Keep API keys and channel credentials encrypted and server-side.
- For custom OpenAI-compatible base URLs, require HTTPS; block loopback, private, link-local, metadata, and reserved destinations; revalidate DNS after redirects to prevent SSRF and rebinding.
- Separate BYOK usage from managed provider credentials and billing.
- Redact personal data before model calls unless the workspace explicitly requires it.
- Attach source, metric, period, and freshness metadata to important findings.
- Require confirmation before agents take external or destructive actions.
- Make report generation and delivery idempotent and retryable.
- Record prompt/version/model provenance for reproducible evaluations.
- Allow workspace export, retention controls, and deletion.

## Delivery phases

1. Prove reliable Cloudflare and Google data collection.
2. Ship deterministic insight cards without an LLM.
3. Add BYOK conversational analysis over bounded evidence.
4. Add scheduled analysis workflows and report history.
5. Add managed AI allowances and delivery channels.
6. Expand revenue, competitor, agency, and skill ecosystems.

This order prevents an impressive demo from hiding unreliable data or uncontrolled model costs.
