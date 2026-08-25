import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Documentation — Dashloom', description: 'Install Dashloom and understand its data, dashboard, agent, and reporting architecture.', alternates: { canonical: '/docs' } };

export default function DocsPage() {
  return <main className="content-page">
    <nav className="site-nav"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></Link><div className="nav-actions"><Link className="text-link" href="/">Home</Link><a className="button button-small" href="https://github.com/dashloom-dev/dashloom">GitHub ↗</a></div></nav>
    <article className="prose-shell"><div className="eyebrow"><span />Documentation</div><h1>Build and run Dashloom</h1><p className="lead">Dashloom is an open-source AI product intelligence platform. Its data layer establishes trustworthy facts; specialized agents explain change, recommend action, and prepare recurring reports.</p>
      <h2>Local development</h2><pre><code>npm install{`\n`}npm run dev</code></pre><p>Open the local address shown by the development server. The public product page currently uses fictional demonstration data.</p>
      <h2>Database schema</h2><pre><code>npm run db:generate</code></pre><p>The migrations define workspaces, products, connectors, metrics, AI provider accounts, agent profiles, analysis runs, append-only usage events, reports, and retryable deliveries. Production credentials are never stored in source configuration.</p>
      <h2>Dashboard and agent presets</h2><p>Dashloom defines Indie Hacker, SaaS Revenue, SEO Growth, Cloudflare Operations, and Agency Client dashboards. Each view is paired with a specialized agent while sharing the same normalized workspace data.</p>
      <h2>Community AI configuration</h2><p>Community deployments will support a server-side OpenAI-compatible endpoint, encrypted API key, and model selection. Managed Cloud usage is recorded separately and enforced by server-owned plan entitlements.</p>
      <h2>Trust boundary</h2><p>LLMs receive bounded evidence assembled from deterministic calculations. Imported text cannot change agent instructions, and important findings retain their metric, period, source, and freshness provenance.</p>
      <div className="notice"><strong>Architecture defined, integrations still gated</strong><p>Cloudflare/Google authorization and AI execution are not described as production-ready until credential encryption, verification, retries, quotas, observability, and evaluations exist.</p></div>
    </article>
  </main>;
}
