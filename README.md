<p align="center">
  <img src="public/favicon.svg" width="72" alt="Dashloom logo" />
</p>

<h1 align="center">Dashloom</h1>

<p align="center">Turn every product signal into your next move.</p>

<p align="center"><a href="README.zh-CN.md">简体中文</a> · <a href="https://dashloom.dev">Website</a> · <a href="https://dashloom.dev/docs">Documentation</a></p>

Dashloom is an open-source AI product intelligence platform for indie hackers and small teams running one or more products. It connects operations, acquisition, search, revenue, and competitor signals; specialized agents then explain change, identify opportunities, answer questions with evidence, and generate recurring reports.

![Dashloom social preview](public/og.png)

## Current milestone

The repository currently contains:

- A production-shaped English landing page and Chinese localized entry
- A realistic multi-product dashboard preview with fictional data
- A Cloudflare-compatible Vinext runtime
- A tenant-aware D1 and Drizzle schema for workspaces, products, connectors, metrics, and sync runs
- Foundations for BYOK/managed AI providers, agent profiles, usage events, reports, and delivery channels
- Product definitions for Indie Hacker, SaaS Revenue, SEO Growth, Cloudflare Operations, and Agency Client dashboards
- Canonical URLs, localized sitemap entries, robots rules, and social metadata

Cloudflare and Google authorization, scheduled synchronization, and public account registration are the next implementation slice. AI analysis remains behind the same production gate: bounded evidence, encrypted credentials, usage enforcement, retryable workflows, and evaluations must exist before it is advertised as a working integration.

## AI model options

- **Community:** configure an OpenAI-compatible API endpoint, API key, and model in your own deployment.
- **Dashloom Cloud:** planned managed AI allowances, scheduled analysis, report delivery, and optional BYOK.

API keys stay server-side and must be encrypted before persistence. LLMs explain server-calculated metrics; they do not become the source of truth for revenue, rankings, or operational data.

See the [product strategy](docs/product-strategy.md) and [public roadmap](docs/roadmap.md).

## Local development

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run dev
```

Open the local address printed by the development server.

## Validate

```bash
npm run typecheck
npm run lint
npm run build
npm run db:generate
```

## Architecture boundaries

- Product UI calls stable server APIs; it does not own authorization or credential truth.
- Every product, connector, metric, and sync run belongs to a workspace.
- Credentials stay server-side and will be encrypted before persistence.
- Provider identifiers remain outside core product identities.
- Sync writes are designed to become idempotent before external connectors are enabled.

## License

[MIT](LICENSE)
