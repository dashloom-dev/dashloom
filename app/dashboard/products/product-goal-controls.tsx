'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Product = { id: string; name: string };
type Goal = { id: string; productId: string; productName: string; name: string; metric: string; source: string | null; currency: string | null; direction: string; period: string; targetValue: number; enabled: boolean; currentValue: number | null; progressPercent: number | null; status: string; periodStart: string; periodEnd: string };

export function ProductGoalControls({ products, goals, canManage }: { products: Product[]; goals: Goal[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('Saving the goal…');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/product-goals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: form.get('productId'), name: form.get('name'), metric: form.get('metric'), source: form.get('source'), currency: form.get('currency'), direction: form.get('direction'), period: form.get('period'), targetValue: Number(form.get('targetValue')) }) });
    const result = await response.json() as { error?: string };
    setPending(false);
    setMessage(result.error || 'Goal saved. Future Agent runs can cite its live progress.');
    if (response.ok) { (event.target as HTMLFormElement).reset(); router.refresh(); }
  }

  async function toggle(goal: Goal) {
    setPending(true);
    const response = await fetch('/api/product-goals', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: goal.id, enabled: !goal.enabled }) });
    const result = await response.json() as { error?: string };
    setPending(false);
    setMessage(result.error || `Goal ${goal.enabled ? 'paused' : 'enabled'}.`);
    if (response.ok) router.refresh();
  }

  async function remove(goal: Goal) {
    if (!window.confirm(`Delete “${goal.name}”? Historical Agent evidence remains frozen.`)) return;
    setPending(true);
    const response = await fetch('/api/product-goals', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: goal.id }) });
    const result = await response.json() as { error?: string };
    setPending(false);
    setMessage(result.error || 'Goal deleted.');
    if (response.ok) router.refresh();
  }

  return <section className="product-goal-center app-panel">
    <div className="panel-title"><div><span>OPERATING TARGETS</span><h2>Give the Agent a definition of success</h2></div><span className="status-pill">{goals.filter((goal) => goal.enabled).length} active</span></div>
    <p className="comparison-intro">Targets are evaluated deterministically over rolling periods. The Agent receives progress as cited evidence; it never invents or silently changes a target.</p>
    <form className="connector-form product-goal-form" onSubmit={create}>
      <div className="settings-grid">
        <label>Product<select name="productId" required>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label>Goal name<input name="name" required minLength={2} maxLength={80} placeholder="Monthly revenue target" /></label>
        <label>Metric<input name="metric" required pattern="[a-z][a-z0-9_]{0,79}" placeholder="revenue" /></label>
        <label>Source (optional)<input name="source" pattern="[a-z][a-z0-9_:-]{0,79}" placeholder="stripe" /></label>
        <label>Direction<select name="direction" defaultValue="at_least"><option value="at_least">At least</option><option value="at_most">At most</option></select></label>
        <label>Target<input name="targetValue" type="number" min="0" step="any" required defaultValue="1000" /></label>
        <label>Rolling period<select name="period" defaultValue="monthly"><option value="daily">Daily · 1 day</option><option value="weekly">Weekly · 7 days</option><option value="monthly">Monthly · 30 days</option><option value="quarterly">Quarterly · 90 days</option></select></label>
        <label>Currency (optional)<input name="currency" pattern="[A-Za-z]{3}" maxLength={3} placeholder="USD" /></label>
      </div>
      <footer><small>{message || (canManage ? 'Use the exact normalized metric name. Currency prevents revenue from being mixed across denominations.' : 'Owner or admin access is required to manage shared targets.')}</small><button className="app-primary" disabled={!canManage || pending}>{pending ? 'Working…' : 'Add goal'}</button></footer>
    </form>
    <div className="product-goal-grid">{goals.map((goal) => <article key={goal.id} data-status={goal.enabled ? goal.status : 'paused'}>
      <header><div><span>{goal.productName} · {goal.period}</span><h3>{goal.name}</h3></div><b data-status={goal.enabled ? goal.status : 'paused'}>{goal.enabled ? goal.status.replaceAll('_', ' ') : 'paused'}</b></header>
      <div className="goal-progress"><i style={{ width: `${Math.min(100, goal.progressPercent || 0)}%` }} /></div>
      <p><strong>{formatGoalValue(goal.currentValue, goal.currency)}</strong><span>{goal.direction === 'at_least' ? '≥' : '≤'} {formatGoalValue(goal.targetValue, goal.currency)}</span></p>
      <small>{goal.metric}{goal.source ? ` · ${goal.source}` : ' · all sources'} · {goal.periodStart}–{goal.periodEnd}{goal.progressPercent === null ? ' · waiting for data' : ` · ${goal.progressPercent.toFixed(1)}% progress`}</small>
      {canManage && <footer><button className="report-deliver" type="button" disabled={pending} onClick={() => toggle(goal)}>{goal.enabled ? 'Pause' : 'Enable'}</button><button className="report-deliver" type="button" disabled={pending} onClick={() => remove(goal)}>Delete</button></footer>}
    </article>)}{!goals.length && <div className="panel-empty"><p>No operating targets yet. Add one to let the Agent reason about progress instead of change alone.</p></div>}</div>
  </section>;
}

function formatGoalValue(value: number | null, currency: string | null) {
  if (value === null) return '—';
  if (currency) return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}
