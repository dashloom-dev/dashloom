# Dashloom Community architecture

Dashloom Community is a self-contained application. It has no runtime, build, package, source, database, or Git dependency on Dashloom Cloud.

## Dependency direction

```text
Product UI -> authenticated server routes -> workspace services
           -> deterministic evidence -> BYOK agent orchestration
           -> storage boundary (D1 or Supabase PostgreSQL) and provider adapters
```

The browser never proves workspace authorization, decrypts credentials, grants model access, or supplies trusted evidence. Every workspace query resolves membership on the server. Provider content and imported labels are untrusted data.

## Runtime and storage selection

The repository supports three build-time runtime paths:

- Vinext on Cloudflare Workers with a native `DB` D1 binding;
- Next.js on a Node.js host with the parameterized Remote D1 HTTP adapter;
- Next.js on a Node.js host with the pooled Supabase PostgreSQL adapter.

`DASHLOOM_DATABASE` selects the Node.js storage backend. Build aliases swap the database driver, schema, Better Auth dialect, and JSON expressions before the application is built; a running instance does not switch databases per request. D1 and PostgreSQL retain the same application table and column model, while multi-statement operations use a D1 batch or PostgreSQL transaction behind the shared database boundary.

Deployment platforms and application storage are not product evidence sources. Only explicitly connected or imported business, acquisition, search, revenue, and operational aggregates enter `metric_points`.

## Data ownership

- Better Auth owns users, sessions, accounts, verification, and password recovery.
- Workspaces own products, connector mappings, normalized metrics, calculated metrics, competitors, dashboards, agents, reports, schedules, ingestion keys, and audit events.
- Products own product-scoped evidence, goals, conversations, actions, missions, and schedules.
- Connector and BYOK credentials are encrypted server-side and omitted from portable exports.

## Community edition invariants

- AI execution requires a validated workspace-owned BYOK provider.
- Scheduled synchronization and reports execute inside the operator's Worker or through authenticated cron routes on a Node.js host.
- Reports are stored in the selected application database; the Community runtime has no hosted delivery channel.
- Workspace export contains portable product evidence only and strips credentials, identities, roles, model history, and operational secrets.
- Stripe is a read-only revenue connector here; it is not Dashloom subscription billing.

Historical migrations may include tables that existed before the repository split. Community runtime code does not expose or depend on those retired Cloud capabilities. Keeping migration history preserves existing self-hosted upgrade compatibility.

The D1 and PostgreSQL schemas export the same 38 tables and application column names. Business services stay dialect-neutral; only the storage boundary owns database-specific behavior.

Production schema work is complete only after applying the matching migration set to the intended remote database and verifying the resulting schema objects. For D1, also confirm Wrangler reports no pending migration. For Supabase, verify all 38 application tables in the intended project.
