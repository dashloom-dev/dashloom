'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AgentScopeReadiness } from '@/lib/agent-scope';

const specialists = [
  ['portfolio_analyst', 'Portfolio', 'Cross-product priority and resource allocation'],
  ['revenue_analyst', 'Revenue', 'Revenue, retention, refunds, and conversion'],
  ['seo_growth_analyst', 'SEO Growth', 'Queries, rankings, CTR, and acquisition'],
  ['operations_analyst', 'Operations', 'Reliability, deployments, queues, and freshness'],
  ['client_reporting_analyst', 'Client Reporting', 'Client-safe wins, risks, and next actions'],
] as const;

type Brief = { id: string; question: string; scopeLabel: string; status: string; successCount: number; failureCount: number; createdAt: string };

export function ExecutiveBriefForm({ readinessByScope, products, capacity, briefs, canManage }: { readinessByScope: AgentScopeReadiness; products: Array<{ id: string; name: string }>; capacity: { mode: string; capacity: number; remaining: number | null; ready: boolean }; briefs: Brief[]; canManage: boolean }) {
  const router = useRouter();
  const [productId, setProductId] = useState('');
  const readiness = useMemo(() => readinessByScope[productId || 'workspace'] || {}, [productId, readinessByScope]);
  const readyPresets = useMemo(() => specialists.filter(([preset]) => readiness[preset]).map(([preset]) => preset), [readiness]);
  const [selected, setSelected] = useState<string[]>(readyPresets);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  function toggle(preset: string) {
    setSelected((current) => current.includes(preset) ? current.filter((item) => item !== preset) : [...current, preset]);
  }

  function changeProduct(nextProductId: string) {
    setProductId(nextProductId);
    const nextReadiness = readinessByScope[nextProductId || 'workspace'] || {};
    setSelected(specialists.filter(([preset]) => nextReadiness[preset]).map(([preset]) => preset));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('Running specialists against independently frozen evidence…');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/agent/briefings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: form.get('question'), presets: selected, productId: productId || null }) });
    const result = await response.json() as { id?: string; error?: string; status?: string; successes?: number; failures?: number };
    setPending(false);
    setMessage(result.error || `Executive Brief ${result.status}; ${result.successes || 0} specialists completed${result.failures ? ` and ${result.failures} failed safely` : ''}.`);
    if (response.ok && result.id) { router.push(`/dashboard/agent/briefings/${result.id}`); router.refresh(); }
  }

  const capacityMessage = capacity.ready ? 'BYOK · up to five specialists in this brief' : 'Connect a validated BYOK model first.';
  const runnable = canManage && capacity.ready && selected.length >= 2 && selected.length <= capacity.capacity && selected.every((preset) => Boolean(readiness[preset]));

  return <section className="app-panel executive-brief-center">
    <div className="panel-title"><div><span>EXECUTIVE BRIEF</span><h2>Ask the whole operating team</h2></div><span className="status-pill">{capacityMessage}</span></div>
    <p className="comparison-intro">Each specialist receives only matching evidence from the selected product scope and produces independently validated citations. Dashloom then ranks the verified findings deterministically—there is no hidden synthesis model.</p>
    <form onSubmit={submit} className="executive-brief-form">
      <label>Product scope<select name="productId" value={productId} onChange={(event) => changeProduct(event.target.value)}><option value="">All products</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
      <fieldset><legend>Specialists · select 2–5</legend><div className="executive-specialist-grid">{specialists.map(([preset, name, focus]) => <label key={preset} data-ready={readiness[preset]}><input type="checkbox" checked={selected.includes(preset)} disabled={!readiness[preset] || pending} onChange={() => toggle(preset)} /><span><strong>{name}</strong><small>{readiness[preset] ? focus : 'Needs matching recent evidence'}</small></span></label>)}</div></fieldset>
      <label>Executive decision question<textarea name="question" required minLength={3} maxLength={1000} rows={3} defaultValue="Across the selected specialists, what needs executive attention first, why does it matter, and what should we do next?" /></label>
      <footer><small>{message || (selected.length > capacity.capacity ? `This selection needs ${selected.length} runs; capacity is ${capacity.capacity}.` : 'Specialist failures are isolated. Every successful priority links to its own frozen evidence run.')}</small><button className="app-primary" disabled={!runnable || pending}>{pending ? 'Coordinating…' : `Run ${selected.length || 0} specialists`}</button></footer>
    </form>
    <div className="executive-history"><h3>Recent Executive Briefs</h3>{briefs.map((brief) => <Link href={`/dashboard/agent/briefings/${brief.id}`} key={brief.id}><span><strong>{brief.question}</strong><small>{brief.scopeLabel} · {brief.createdAt.slice(0, 10)} · {brief.successCount} completed{brief.failureCount ? ` · ${brief.failureCount} failed` : ''}</small></span><b data-status={brief.status}>{brief.status}</b></Link>)}{!briefs.length && <div className="panel-empty"><p>No coordinated brief has run in this workspace.</p></div>}</div>
  </section>;
}
