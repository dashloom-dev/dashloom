'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAgentScopeReady, type AgentScopeReadiness } from '@/lib/agent-scope';

const specialists = [
  ['portfolio_analyst', 'Portfolio'],
  ['revenue_analyst', 'Revenue'],
  ['seo_growth_analyst', 'SEO Growth'],
  ['operations_analyst', 'Operations'],
  ['client_reporting_analyst', 'Client Reporting'],
] as const;

type Capacity = { mode: string; capacity: number; remaining: number | null; ready: boolean };

export function ScheduleForm({ readinessByScope, defaultPreset, products, timezone, capacity, canManage }: { readinessByScope: AgentScopeReadiness; defaultPreset: string; products: Array<{ id: string; name: string }>; timezone: string; capacity: Capacity; canManage: boolean }) {
  const router = useRouter();
  const [productId, setProductId] = useState('');
  const readiness = useMemo(() => readinessByScope[productId || 'workspace'] || {}, [productId, readinessByScope]);
  const readyPresets = useMemo(() => specialists.filter(([value]) => readiness[value]).map(([value]) => value), [readiness]);
  const [kind, setKind] = useState<'specialist' | 'executive'>('specialist');
  const [preset, setPreset] = useState(defaultPreset);
  const [executivePresets, setExecutivePresets] = useState<string[]>(readyPresets);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const specialistReady = isAgentScopeReady(readinessByScope, productId, preset);
  const executiveReady = capacity.ready && executivePresets.length >= 2 && executivePresets.length <= capacity.capacity && executivePresets.every((value) => Boolean(readiness[value]));

  function toggle(value: string) {
    setExecutivePresets((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function changeProduct(nextProductId: string) {
    setProductId(nextProductId);
    const nextReadiness = readinessByScope[nextProductId || 'workspace'] || {};
    setExecutivePresets(specialists.filter(([value]) => nextReadiness[value]).map(([value]) => value));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('Calculating the next intelligence run…');
    const form = new FormData(event.currentTarget);
    const body = { name: String(form.get('name')), kind, agentPreset: preset, executivePresets, executiveQuestion: kind === 'executive' ? String(form.get('executiveQuestion') || '') : undefined, productId: productId || null, cadence: String(form.get('cadence')), timezone: String(form.get('timezone')), hourLocal: Number(form.get('hourLocal')), dayOfWeek: Number(form.get('dayOfWeek')), dayOfMonth: Number(form.get('dayOfMonth')), channelIds: [] };
    const response = await fetch('/api/report-schedules', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    setPending(false);
    setMessage(result.error || `${kind === 'executive' ? 'Executive Brief' : 'Specialist report'} schedule created.`);
    if (response.ok) router.refresh();
  }

  const ready = kind === 'executive' ? executiveReady : specialistReady;
  return <form className="connector-form report-schedule-form" onSubmit={submit}>
    <h2>Schedule recurring intelligence</h2>
    <div className="schedule-kind-switch" role="group" aria-label="Report type"><button type="button" data-active={kind === 'specialist'} onClick={() => setKind('specialist')}>One specialist</button><button type="button" data-active={kind === 'executive'} onClick={() => setKind('executive')}>Executive Brief</button></div>
    <div className="settings-grid">
      <label>Schedule name<input key={kind} name="name" required defaultValue={kind === 'executive' ? 'Weekly executive brief' : 'Weekly operator brief'} /></label>
      <label>Product scope<select name="productId" value={productId} onChange={(event) => changeProduct(event.target.value)}><option value="">All products</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
      {kind === 'specialist' && <label>Agent<select name="agentPreset" value={preset} onChange={(event) => setPreset(event.target.value)}>{specialists.map(([value, label]) => <option key={value} value={value} disabled={!readiness[value]}>{label}{readiness[value] ? '' : ' · needs data'}</option>)}</select></label>}
      <label>Cadence<select name="cadence" defaultValue="weekly"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label>Timezone<input name="timezone" required defaultValue={timezone} /></label>
      <label>Local hour (0–23)<input name="hourLocal" type="number" min="0" max="23" defaultValue="8" required /></label>
      <label>Weekday (0 Sun–6 Sat)<input name="dayOfWeek" type="number" min="0" max="6" defaultValue="1" /></label>
      <label>Month day (1–31)<input name="dayOfMonth" type="number" min="1" max="31" defaultValue="1" /></label>
    </div>
    {kind === 'executive' && <div className="scheduled-executive-fields"><fieldset><legend>Specialists · select 2–5</legend><div className="scheduled-specialist-grid">{specialists.map(([value, label]) => <label key={value} data-ready={readiness[value]}><input type="checkbox" checked={executivePresets.includes(value)} disabled={!readiness[value] || pending} onChange={() => toggle(value)} /><span>{label}</span></label>)}</div></fieldset><label>Recurring executive question<textarea name="executiveQuestion" required minLength={3} maxLength={1000} rows={3} defaultValue="What needs executive attention first, why does it matter, and what should the team do next?" /></label><small>BYOK supports up to five specialists per occurrence.</small></div>}
    <footer><small>{message || (ready ? 'Every occurrence keeps this product scope, freezes matching evidence, and retries safely in your deployment.' : kind === 'executive' ? `Choose 2–${capacity.capacity || 0} specialists with evidence in this scope.` : 'This product scope needs matching evidence and a connected model.')}</small><button className="app-primary" disabled={!canManage || !ready || pending}>{pending ? 'Working…' : 'Create schedule'}</button></footer>
  </form>;
}
