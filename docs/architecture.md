# Dashloom Community architecture

Dashloom Community is a self-contained application. It has no runtime, build, package, source, database, or Git dependency on Dashloom Cloud.

## Dependency direction

```text
Product UI -> authenticated server routes -> workspace services
           -> deterministic evidence -> BYOK agent orchestration
           -> D1 repositories and provider adapters
```

The browser never proves workspace authorization, decrypts credentials, grants model access, or supplies trusted evidence. Every workspace query resolves membership on the server. Provider content and imported labels are untrusted data.

## Data ownership

- Better Auth owns users, sessions, accounts, verification, and password recovery.
- Workspaces own products, connector mappings, normalized metrics, calculated metrics, competitors, dashboards, agents, reports, schedules, ingestion keys, and audit events.
- Products own product-scoped evidence, goals, conversations, actions, missions, and schedules.
- Connector and BYOK credentials are encrypted server-side and omitted from portable exports.

## Community edition invariants

- AI execution requires a validated workspace-owned BYOK provider.
- Scheduled synchronization and reports execute inside the operator's own Worker.
- Reports are stored locally; the Community runtime has no hosted delivery channel.
- Workspace export contains portable product evidence only and strips credentials, identities, roles, model history, and operational secrets.
- Stripe is a read-only revenue connector here; it is not Dashloom subscription billing.

Historical migrations may include tables that existed before the repository split. Community runtime code does not expose or depend on those retired Cloud capabilities. Keeping migration history preserves existing self-hosted upgrade compatibility.

Production schema work is complete only after applying migrations to the intended remote D1 database, confirming no pending migrations, and verifying affected schema objects.
