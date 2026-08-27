import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms — Dashloom Community', description: 'Responsible use of the self-hosted Dashloom Community software.', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return <main className="content-page"><nav className="site-nav"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></Link><div className="nav-actions"><Link className="text-link" href="/privacy">Privacy</Link><a className="button button-small" href="https://github.com/dashloom-dev/dashloom#readme">Docs ↗</a></div></nav><article className="prose-shell"><div className="eyebrow"><span />Terms</div><h1>Use Dashloom responsibly.</h1><p className="lead">The Community source code is provided under the repository license.</p><h2>Authority</h2><p>You must have authority to connect every account, database, endpoint, domain, and dataset. Do not use the software to violate law, provider terms, privacy rights, security controls, or intellectual property.</p><h2>Operator responsibility</h2><p>You are responsible for infrastructure, credentials, backups, provider agreements, metric definitions, model selection, and decisions made from generated analysis. Review consequential findings against their cited evidence.</p><h2>Warranty</h2><p>The open-source software is supplied under its license without warranties. Self-hosted availability depends on your infrastructure and third-party providers.</p></article></main>;
}
