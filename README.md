# Dashloom Community

[简体中文](README.zh-CN.md) · English

Self-hosted AI product intelligence for teams that want one evidence layer across product analytics, revenue, acquisition, infrastructure, and delivery systems.

Dashloom Community normalizes operational signals, calculates deterministic metrics, and lets specialized Agents analyze the resulting evidence with your own OpenAI-compatible model. Your application, D1 database, provider credentials, schedules, and reports run in infrastructure you control.

![Dashloom Community overview with fictional data](docs/images/readme/overview-en.png)

> All screenshots use fictional products, identities, domains, and metrics. They are rendered with the real Community UI components and styles.

## What is included

- Product-scoped evidence, goals, competitors, dashboards, actions, and Growth Missions.
- Five intelligence views: Indie Hacker, SaaS Revenue, SEO Growth, Cloudflare Operations, and Agency Client.
- BYOK Agent conversations, Executive Briefs, model comparison, task history, and evidence citations.
- Signal Radar for deterministic period comparisons and cross-signal hypotheses without causal overclaiming.
- Cloudflare, Google Analytics/Search Console, Bing Webmaster, Stripe revenue, Lemon Squeezy, Creem, Polar, Paddle, Supabase, GitHub, Vercel, D1, and Custom REST connectors.
- Manual imports, open ingestion API keys, calculated metrics, scheduled synchronization, and locally stored reports.
- Connector and Agent Skill SDKs, reviewed community extensions, audit history, and portable evidence export.

Dashloom Community is a standalone open-source product. It has no source, package, runtime, database, deployment, Git, or build dependency on the private Dashloom Cloud repository.

## Product tour

### Evidence-ranked Signal Radar

Dashloom compares matching products, sources, metrics, currencies, and dimensions before promoting a change. Agent interpretation happens after deterministic ranking and keeps correlation separate from causation.

![Dashloom Signal Radar with fictional data](docs/images/readme/signal-radar-en.png)

### Products as data-isolation boundaries

Each product owns its connector mappings, normalized metrics, goals, competitors, Agent evidence, actions, missions, and schedules. Coverage cards show what is actually connected and how fresh the evidence is.

![Dashloom product portfolio with fictional data](docs/images/readme/products-en.png)

## Architecture

```text
Product UI
    │
    ▼
Authenticated server routes ──► workspace and product authorization
    │
    ├──► provider adapters ──► normalized evidence in D1
    ├──► deterministic metrics, goals, health, and Signal Radar
    └──► BYOK Agent orchestration ──► cited findings and actions
```

- Better Auth owns users, sessions, accounts, verification, and password recovery.
- Workspaces own products, connectors, normalized metrics, reports, schedules, ingestion keys, and audit events.
- Provider and model credentials are encrypted server-side and never included in portable exports.
- The browser never grants workspace access, decrypts credentials, or supplies trusted evidence.

See [the architecture guide](docs/architecture.md) for the complete boundary and data-ownership model.

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- A Cloudflare account for production deployment

> **Database boundary:** Community v0.1 starts from a new, Community-only D1 baseline. Use a fresh D1 database; do not point this repository at an existing Dashloom Cloud or pre-release Dashloom database.
- Wrangler 4.x, installed through this repository's development dependencies
- An OpenAI-compatible provider key if you want to run Agents

## Local installation

### 1. Clone and install

```bash
git clone https://github.com/dashloom-dev/dashloom.git
cd dashloom
npm install
```

For reproducible CI installs, use `npm ci` instead of `npm install`.

### 2. Create the local environment file

macOS or Linux:

```bash
cp .dev.vars.example .dev.vars
```

Windows PowerShell:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Generate two independent random values and place them in `.dev.vars` as `BETTER_AUTH_SECRET` and `CREDENTIALS_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run the command twice. Never reuse these secrets, commit `.dev.vars`, or put provider keys in `NEXT_PUBLIC_*` variables.

Minimum local configuration:

```dotenv
BETTER_AUTH_SECRET=replace-with-a-random-value-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
CREDENTIALS_ENCRYPTION_KEY=replace-with-a-different-random-value
AUTH_REQUIRE_EMAIL_VERIFICATION=false
```

Google OAuth, transactional email, and report cron variables are optional for the first local run. Their complete names are documented in [.dev.vars.example](.dev.vars.example).

### 3. Initialize the local D1 database

```bash
npm run db:migrate:local
npm run db:status:local
```

Wrangler stores the local database under the ignored `.wrangler/` directory. These commands do not touch a remote D1 database.

### 4. Start Dashloom

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create the first local account, and Dashloom will create its isolated Community workspace.

## First-use tutorial

### Step 1: Add a product

Open **Products**, then add the product name, public domain, and category. A product is the isolation boundary used by connector mappings, evidence, dashboards, Agent conversations, goals, and recurring jobs.

### Step 2: connect or import evidence

Open **Data sources** and choose one path:

- connect a supported provider with a least-privilege credential;
- configure a read-only aggregate D1 query;
- import normalized metric rows manually;
- create a scoped ingestion key for the TypeScript SDK or Connector Worker;
- connect a Custom REST endpoint that returns the validated aggregate metric contract.

After synchronization, check the product coverage card for source freshness, stored point count, and Agent readiness. Dashloom does not add demo evidence to a real workspace.

### Step 3: connect your model

Open **Settings**, add an OpenAI-compatible BYOK provider, and select the model to use. The credential is encrypted with `CREDENTIALS_ENCRYPTION_KEY` before it is stored in D1.

Community Agent execution is BYOK-only. No managed model allowance or Dashloom subscription is required.

### Step 4: ask an evidence-backed question

Open **Dashloom Agent**, select a specialist and product scope, then ask a question such as:

```text
Which material changes should we investigate this week, and which evidence supports each recommendation?
```

An Agent run freezes the evidence bundle used for the answer. Findings must cite evidence from that bundle and disclose truncation or missing coverage.

### Step 5: operate the recurring loop

- Use **Signal radar** to review deterministic risks and opportunities.
- Promote useful findings into **Agent actions** and measure outcomes.
- Turn repeatable improvement work into **Growth missions**.
- Create local report and synchronization schedules.
- Keep the Worker cron enabled so due schedules and action outcomes are processed.

## Environment reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Yes | Signs authentication state; minimum 32 characters. |
| `BETTER_AUTH_URL` | Yes | Canonical application origin used by Better Auth. |
| `CREDENTIALS_ENCRYPTION_KEY` | Yes | Encrypts connector and BYOK credentials server-side. |
| `REPORT_CRON_SECRET` | Recommended | Protects manual cron endpoints. Use a separate random value. |
| `GOOGLE_OAUTH_CLIENT_ID` | For Google | Google Web Application OAuth client ID. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | For Google | Google OAuth client secret. |
| `AUTH_EMAIL_WEBHOOK_URL` | For email delivery | HTTPS endpoint for verification and password-reset mail. |
| `AUTH_EMAIL_WEBHOOK_SECRET` | For email delivery | Authentication secret sent to the email relay. |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | Optional | Set to `true` when production email delivery is configured. |
| `NEXT_PUBLIC_APP_URL` | Optional | Public, non-secret origin override; belongs in `.env`. |

Connector and model keys are entered through authenticated product forms. Do not put them in public environment variables or commit them to the repository.

## Production deployment on Cloudflare

1. Create a D1 database and replace the placeholder database name and ID in `wrangler.jsonc`.
2. Configure production secrets with `npx wrangler secret put <NAME>`; never copy local secrets into source control.
3. Apply migrations to the intended remote database:

   ```bash
   npx wrangler d1 migrations apply <your-database-name> --remote
   npx wrangler d1 migrations list <your-database-name> --remote
   ```

4. Confirm there are no pending migrations and verify the affected tables in that exact database.
5. Validate and deploy:

   ```bash
   npm run build
   npx wrangler deploy --dry-run
   npx wrangler deploy
   ```

6. Test authentication, product isolation, connectors, BYOK analysis, schedules, export, and recovery against the deployed origin.

A migration file existing in the repository is not proof that production was migrated. Remote production schema work is complete only after the intended D1 database has been applied and verified.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run validate:extensions
npm run validate:connector-worker
npm run eval:agent
```

## Troubleshooting

- **`DB` binding is unavailable:** confirm the D1 binding in `wrangler.jsonc` is named `DB`, then restart the development server.
- **Authentication configuration error:** ensure `BETTER_AUTH_SECRET` is at least 32 characters and `BETTER_AUTH_URL` matches the current origin.
- **Provider credentials cannot be saved:** configure a separate `CREDENTIALS_ENCRYPTION_KEY` of at least 32 characters.
- **Agent is not ready:** connect a BYOK model and verify that the selected product has recent metrics matching that specialist.
- **Signal Radar is empty:** collect two comparable periods of evidence; Dashloom will not invent signals when the threshold is not crossed.
- **Scheduled work does not run:** confirm the Worker cron is deployed and inspect automation and sync status in the application.

## Documentation

- [Architecture and security boundaries](docs/architecture.md)
- [First-value path](docs/first-value-path.md)
- [Connector account lifecycle](docs/connector-account-lifecycle.md)
- [Bing Webmaster setup](docs/bing-webmaster-setup.md)
- [Automatic synchronization](docs/automatic-sync-and-retention.md)
- [Automated reports](docs/automated-reports.md)
- [Agent Executive Briefs](docs/agent-executive-briefs.md)
- [Agent task center](docs/agent-task-center.md)
- [Teams and portable data](docs/teams-and-data-control.md)
- Connector-specific guides are available under [`docs/`](docs/).

## Security

Use least-privilege provider credentials, rotate leaked secrets immediately, keep OAuth callbacks on the configured origin, and review generated Agent findings against their cited evidence before acting on them. Do not include credentials, personal data, or unbounded raw event payloads in imported metrics.

## License

[MIT](LICENSE)
