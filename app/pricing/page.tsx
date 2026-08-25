import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing — Dashloom',
  description: 'Use your own model with Dashloom Community or choose managed AI analysis and reporting in Dashloom Cloud.',
  alternates: { canonical: '/pricing' },
};

const plans = [
  { name: 'Community', price: 'Free', copy: 'For developers who want to own deployment and AI usage.', features: ['Self-hosted core', 'All five dashboard presets', 'Bring your own AI API and model', 'Manual analysis and self-managed schedules'], action: 'View on GitHub' },
  { name: 'Solo', price: '$9', suffix: '/month', copy: 'Planned managed intelligence for independent builders.', features: ['Up to 10 products', 'Managed daily AI allowance', 'Daily and weekly analysis', 'Email and webhook delivery'], action: 'Cloud coming soon' },
  { name: 'Studio', price: '$29', suffix: '/month', copy: 'Planned intelligence layer for small product teams.', features: ['Up to 30 products', 'Larger shared AI allowance', 'Daily, weekly, and monthly reports', 'Slack, Discord, alerts, and advanced agents'], action: 'Cloud coming soon', featured: true },
];

export default function PricingPage() {
  return <main className="content-page">
    <nav className="site-nav">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></Link>
      <div className="nav-actions"><Link className="text-link" href="/">Home</Link><a className="button button-small" href="https://github.com/dashloom-dev/dashloom">GitHub ↗</a></div>
    </nav>
    <section className="pricing-hero"><div className="eyebrow"><span />Open core · Flexible AI</div><h1>Bring your model.<br /><em>Or use ours.</em></h1><p>Community stays self-hostable with BYOK. Dashloom Cloud adds managed AI allowances, scheduled analysis, report delivery, and operational reliability.</p></section>
    <section className="pricing-grid">
      {plans.map((plan) => <article className={plan.featured ? 'featured' : ''} key={plan.name}><span>{plan.name}</span><div className="price">{plan.price}<small>{plan.suffix}</small></div><p>{plan.copy}</p><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><a className={plan.featured ? 'button' : 'button button-secondary'} href={plan.name === 'Community' ? 'https://github.com/dashloom-dev/dashloom' : 'mailto:hello@dashloom.dev'}>{plan.action}</a></article>)}
    </section>
    <p className="pricing-note">Cloud plans are roadmap targets, not currently available subscriptions. Pricing will be validated with early users before launch.</p>
  </main>;
}
