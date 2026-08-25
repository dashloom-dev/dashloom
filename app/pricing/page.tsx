import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing — Dashloom',
  description: 'Start with the open-source Dashloom Community edition and follow the managed Cloud roadmap.',
  alternates: { canonical: '/pricing' },
};

const plans = [
  { name: 'Community', price: 'Free', copy: 'For developers who want to own the deployment.', features: ['Self-hosted core', 'Unlimited local products', 'Cloudflare and Google connectors', 'Community support'], action: 'View on GitHub' },
  { name: 'Solo', price: '$9', suffix: '/month', copy: 'Planned managed hosting for independent builders.', features: ['Up to 10 products', 'Hourly managed sync', '3 workspace members', 'Email reports'], action: 'Cloud coming soon' },
  { name: 'Studio', price: '$29', suffix: '/month', copy: 'Planned operations layer for small product teams.', features: ['Up to 30 products', '15-minute sync', 'Alerts and scheduled reports', 'Advanced connectors'], action: 'Cloud coming soon', featured: true },
];

export default function PricingPage() {
  return <main className="content-page">
    <nav className="site-nav">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></Link>
      <div className="nav-actions"><Link className="text-link" href="/">Home</Link><a className="button button-small" href="https://github.com/dashloom-dev/dashloom">GitHub ↗</a></div>
    </nav>
    <section className="pricing-hero"><div className="eyebrow"><span />Simple pricing</div><h1>Own the core.<br /><em>Pay for the operations.</em></h1><p>Community stays self-hostable. Dashloom Cloud will charge for managed sync, reliability, reports, and team workflows.</p></section>
    <section className="pricing-grid">
      {plans.map((plan) => <article className={plan.featured ? 'featured' : ''} key={plan.name}><span>{plan.name}</span><div className="price">{plan.price}<small>{plan.suffix}</small></div><p>{plan.copy}</p><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><a className={plan.featured ? 'button' : 'button button-secondary'} href={plan.name === 'Community' ? 'https://github.com/dashloom-dev/dashloom' : 'mailto:hello@dashloom.dev'}>{plan.action}</a></article>)}
    </section>
    <p className="pricing-note">Cloud plans are roadmap targets, not currently available subscriptions. Pricing will be validated with early users before launch.</p>
  </main>;
}
