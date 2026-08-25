<p align="center">
  <img src="public/favicon.svg" width="72" alt="Dashloom logo" />
</p>

<h1 align="center">Dashloom</h1>

<p align="center">Every product signal, in one view.</p>

<p align="center"><a href="README.zh-CN.md">简体中文</a> · <a href="https://dashloom.dev">Website</a> · <a href="https://dashloom.dev/docs">Documentation</a></p>

Dashloom is an open-source, Cloudflare-native command center for indie hackers and small teams running multiple products. It is designed to bring Cloudflare Workers Analytics, Google Analytics 4, Google Search Console, and product business metrics into one workspace.

![Dashloom social preview](public/og.png)

## Current milestone

The repository currently contains:

- A production-shaped English landing page and Chinese localized entry
- A realistic multi-product dashboard preview with fictional data
- A Cloudflare-compatible Vinext runtime
- A tenant-aware D1 and Drizzle schema for workspaces, products, connectors, metrics, and sync runs
- Canonical URLs, localized sitemap entries, robots rules, and social metadata

Cloudflare and Google authorization, scheduled synchronization, and public account registration are the next implementation slice. They are not advertised as working integrations until credential handling, verification, retries, and tests are complete.

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
