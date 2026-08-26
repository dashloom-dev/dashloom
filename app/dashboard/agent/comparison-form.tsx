'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const agents = [['portfolio_analyst', 'Portfolio Analyst'], ['revenue_analyst', 'Revenue Analyst'], ['seo_growth_analyst', 'SEO Growth Analyst'], ['operations_analyst', 'Operations Analyst'], ['client_reporting_analyst', 'Client Reporting Analyst']] as const;
type Provider = { id: string; displayName: string; model: string; mode: string };

export function ComparisonForm({ providers, readiness, defaultPreset, canManage }: { providers: Provider[]; readiness: Record<string, boolean>; defaultPreset: string; canManage: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState(''); const [preset, setPreset] = useState(defaultPreset);
  const ready = Boolean(readiness[preset]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const providerIds = form.getAll('providerIds').map(String);
    if (!ready) { setMessage('Sync evidence supported by this specialist before comparing models.'); return; }
    if (providerIds.length < 2 || providerIds.length > 4) { setMessage('Select between two and four connected providers.'); return; }
    setPending(true); setMessage('Freezing one evidence bundle and running providers in parallel…');
    const response = await fetch('/api/agent/comparisons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: form.get('question'), preset, providerIds }) });
    const result = await response.json() as { error?: string; comparisonId?: string }; setPending(false); setMessage(result.error || 'Comparison completed with versioned provider results.');
    if (response.ok && result.comparisonId) router.push(`/dashboard/agent/comparisons/${result.comparisonId}`);
  }
  return <form className="comparison-form" onSubmit={submit}><div className="comparison-form-grid"><label>Analysis specialist<select name="preset" value={preset} onChange={(event) => setPreset(event.target.value)}>{agents.map(([value, label]) => <option key={value} value={value} disabled={!readiness[value]}>{label}{readiness[value] ? '' : ' · needs data'}</option>)}</select></label><fieldset><legend>Compare 2–4 providers</legend>{providers.map((provider) => <label className="comparison-provider" key={provider.id}><input type="checkbox" name="providerIds" value={provider.id} /><span><b>{provider.displayName}</b><small>{provider.model} · {provider.mode}</small></span></label>)}</fieldset></div><label>Decision question<textarea name="question" required minLength={3} maxLength={1000} disabled={!ready || pending} placeholder={ready ? 'Which risks and opportunities deserve action this week?' : 'Sync matching evidence to enable this specialist.'} /></label><footer><small>{message || 'Every model receives the same specialist-matched evidence, prompt version, Agent Skill versions, and output contract.'}</small><button className="app-primary" disabled={!ready || !canManage || providers.length < 2 || pending}>{pending ? 'Comparing…' : 'Run comparison'}</button></footer></form>;
}
