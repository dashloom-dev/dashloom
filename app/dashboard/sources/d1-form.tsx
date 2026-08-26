'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const sampleSql = `SELECT
  date(created_at) AS metric_date,
  count(*) AS signups
FROM users
WHERE created_at >= datetime('now', '-14 days')
GROUP BY date(created_at)
ORDER BY metric_date`;

export function D1Form({ products }: { products: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage('Validating read-only D1 access…');
    const form = new FormData(event.currentTarget);
    let metrics: Record<string, string>;
    try { metrics = JSON.parse(String(form.get('metrics'))) as Record<string, string>; }
    catch { setPending(false); setMessage('Metric mapping must be valid JSON, for example {"signups":"signups"}.'); return; }
    const response = await fetch('/api/connectors/d1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...Object.fromEntries(form), metrics }) });
    const result = await response.json() as { error?: string };
    setPending(false); setMessage(result.error || 'D1 database and metric query connected.');
    if (response.ok) router.refresh();
  }
  async function sync() {
    setPending(true); setMessage('Running configured read-only queries…');
    const response = await fetch('/api/sync/d1', { method: 'POST' });
    const result = await response.json() as { error?: string; written?: number };
    setPending(false); setMessage(result.error || `${result.written || 0} D1 business metric points synchronized.`);
    if (response.ok) router.refresh();
  }
  return <form className="connector-form d1-form" onSubmit={connect}>
    <div className="settings-grid"><label>Connection name<input name="displayName" required placeholder="Production business database" /></label><label>Product<select name="productId" required disabled={!products.length}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Cloudflare account ID<input name="accountId" required minLength={20} placeholder="Account ID" /></label><label>D1 database ID<input name="databaseId" required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label><label>API token<input name="apiToken" required type="password" autoComplete="new-password" minLength={20} placeholder="D1 Read token" /></label><label>Date result column<input name="dateColumn" required defaultValue="metric_date" /></label></div>
    <label>Read-only aggregate query<textarea name="sql" required defaultValue={sampleSql} rows={9} /></label>
    <label>Metric mapping (query column → Dashloom metric)<textarea name="metrics" required defaultValue={'{"signups":"signups"}'} rows={3} /></label>
    <footer><small>Dashloom accepts one SELECT/WITH query, rejects mutation syntax, checks that Cloudflare reports zero rows written, and never returns your token to the browser.</small><div><button className="app-secondary" type="button" disabled={pending} onClick={sync}>Sync D1 metrics</button><button className="app-primary" disabled={pending || !products.length}>{pending ? 'Working…' : 'Connect D1'}</button></div></footer>
    {message && <p className="form-message" role="status">{message}</p>}
  </form>;
}
