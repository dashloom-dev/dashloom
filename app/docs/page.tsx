import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Documentation — Dashloom', description: 'Install Dashloom locally and understand the first development milestone.', alternates: { canonical: '/docs' } };

export default function DocsPage() {
  return <main className="content-page">
    <nav className="site-nav"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></Link><div className="nav-actions"><Link className="text-link" href="/">Home</Link><a className="button button-small" href="https://github.com/dashloom-dev/dashloom">GitHub ↗</a></div></nav>
    <article className="prose-shell"><div className="eyebrow"><span />Documentation</div><h1>Build and run Dashloom</h1><p className="lead">Dashloom is being built as a Cloudflare-native, multi-workspace product intelligence platform. This first milestone includes the public product surface and the tenant-aware D1 schema.</p>
      <h2>Local development</h2><pre><code>npm install{`\n`}npm run dev</code></pre><p>Open the local address shown by the development server. The public product page currently uses fictional demonstration data.</p>
      <h2>Database schema</h2><pre><code>npm run db:generate</code></pre><p>The generated migration defines workspaces, memberships, products, connector accounts, resource mappings, metric points, and synchronization runs. Production credentials are never stored in source configuration.</p>
      <h2>Current milestone</h2><ul><li>English product page and localized Chinese entry</li><li>Cloudflare-compatible Vinext runtime</li><li>D1 and Drizzle persistence foundation</li><li>Canonical URLs, hreflang sitemap, robots rules, and social metadata</li></ul>
      <div className="notice"><strong>Not connected yet</strong><p>Cloudflare and Google authorization, scheduled synchronization, and public account registration are the next implementation slice. The interface does not claim those providers are connected before verification and failure handling exist.</p></div>
    </article>
  </main>;
}
