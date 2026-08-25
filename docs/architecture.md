# Dashloom architecture

This document describes the implemented first milestone and the boundaries that future connector, identity, and billing work must preserve.

## Dependency direction

```text
Marketing and product UI
          ↓
Server routes and actions
          ↓
Workspace domain services
          ↓
Evidence builder and deterministic analytics
          ↓
Agent / workflow orchestration
          ↓
D1 repositories, provider adapters, and delivery adapters
```

The browser must not decide workspace authorization, decrypt credentials, accept provider callbacks as trusted, or grant paid entitlements.

## Current data ownership

| Data | Owner | Boundary |
| --- | --- | --- |
| Workspace configuration | `workspaces` | Owner, locale, timezone, and plan |
| Team access | `workspace_members` | A user role inside one workspace |
| Product catalog | `products` | Every product belongs to one workspace |
| External connections | `connector_accounts` | Provider account and encrypted server credential |
| Resource mapping | `product_connector_mappings` | Maps an external resource to one product |
| Time-series values | `metric_points` | Workspace and product scoped metric identity |
| Competitor facts | `competitors`, `competitor_metric_points` | Approved external entities, metrics, and provenance |
| Collection state | `sync_runs` | Observable, retryable provider synchronization |
| AI connection | `ai_provider_accounts` | BYOK or managed provider configuration; secrets remain server-side |
| Dashboard preset | `dashboard_views` | Workspace views over shared normalized data |
| Agent configuration | `agent_profiles` | Role, provider, permissions, and structured instructions |
| Analysis execution | `analysis_runs` | Evidence, lifecycle, findings, tokens, and errors |
| AI usage | `ai_usage_events` | Append-only, idempotent usage and estimated cost ledger |
| Generated report | `reports` | Evidence-derived daily, weekly, monthly, or manual output |
| Delivery | `delivery_channels`, `report_deliveries` | Encrypted channel configuration and retryable delivery state |

Identity records are intentionally not defined by the product schema. A supported authentication library will own users, sessions, verification, password reset, and OAuth accounts. Dashloom only stores stable user identifiers in workspace ownership and membership records.

## Connector contract

Every provider connector must eventually implement:

1. Minimal documented permissions.
2. Server-side credential storage and encryption.
3. Resource discovery without silently granting access.
4. Explicit mapping from provider resource to Dashloom product.
5. Idempotent collection and metric upserts.
6. Retryable errors with stable error codes.
7. Connection health, last successful sync, and user-actionable recovery.
8. Tests for invalid credentials, revoked access, limits, partial results, and retries.

Until all eight conditions exist, a provider may appear in roadmap documentation but must not be described as production-ready.

## Analysis boundary

Dashloom calculates revenue, growth rates, comparisons, anomalies, and data-quality facts in deterministic server modules before invoking an LLM. The model receives a bounded evidence bundle and returns structured findings; it does not query arbitrary workspace tables or redefine metric truth.

Every important finding must retain source, entity, metric, period, freshness, and calculation provenance. Imported provider content is untrusted data and cannot override system instructions or grant tools permission.

Short conversational turns can run through a workspace-scoped Agent. Recurring and multi-step report generation belongs in durable Workflows with idempotent run and delivery keys. Agent schedules wake the appropriate workspace process; they do not replace the report ledger.

## AI provider and entitlement boundary

- Community deployments may configure an OpenAI-compatible endpoint, model, and encrypted API key.
- Custom endpoints must pass server-side HTTPS and outbound-network validation; redirects, DNS resolution, and private address ranges are checked to prevent SSRF.
- Managed Cloud credentials never enter the browser and are separate from BYOK records.
- Plan allowances come from a server-owned catalog.
- Each managed or BYOK call records an append-only usage event.
- A browser-displayed remaining balance is informational, not authorization to spend.
- Failed or duplicate runs must not consume a managed allowance twice.

## Multi-tenant invariant

Every query and mutation involving products, connectors, metrics, or sync runs must resolve a trusted server-side workspace membership before accessing data. A workspace ID supplied by the browser is a selector, not proof of authorization.

## Planned slices

1. Authentication and workspace onboarding.
2. Cloudflare account connection and Workers Analytics collection.
3. Google OAuth with GA4 and Search Console discovery.
4. Scheduled jobs, retries, connector health, and diagnostics.
5. BYOK analysis, evidence-linked chat, and dashboard presets.
6. Scheduled reports, delivery channels, and managed AI allowances.
7. Subscriptions, competitor intelligence, and hosted Cloud operations.

Payment work will introduce its own server-owned catalog, orders, provider event ledger, subscription state machine, and entitlement periods. Browser redirects will never be treated as payment truth.
