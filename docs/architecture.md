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
D1 repositories and provider adapters
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
| Collection state | `sync_runs` | Observable, retryable provider synchronization |

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

## Multi-tenant invariant

Every query and mutation involving products, connectors, metrics, or sync runs must resolve a trusted server-side workspace membership before accessing data. A workspace ID supplied by the browser is a selector, not proof of authorization.

## Planned slices

1. Authentication and workspace onboarding.
2. Cloudflare account connection and Workers Analytics collection.
3. Google OAuth with GA4 and Search Console discovery.
4. Scheduled jobs, retries, connector health, and diagnostics.
5. Reports, alerts, subscriptions, and hosted Cloud operations.

Payment work will introduce its own server-owned catalog, orders, provider event ledger, subscription state machine, and entitlement periods. Browser redirects will never be treated as payment truth.
