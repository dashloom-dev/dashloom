'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type ProductOption = { id: string; name: string };
type CompetitorOption = { id: string; name: string; domain: string | null };

export function CompetitorForm({ products, competitors }: { products: ProductOption[]; competitors: CompetitorOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function createCompetitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage('');
    const response = await fetch('/api/competitors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: form.get('name'), domain: form.get('domain'), productId: form.get('productId') || null }) });
    const result = await response.json() as { error?: string };
    setPending(false); setMessage(result.error || 'Competitor created.');
    if (response.ok) { (event.target as HTMLFormElement).reset(); router.refresh(); }
  }

  async function importMetrics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const competitorId = String(form.get('competitorId'));
    const source = String(form.get('source'));
    const rows = String(form.get('rows')).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [metricDate, metric, value, url = ''] = line.split(',').map((item) => item.trim());
      return { competitorId, source, metricDate, metric, value: Number(value), provenance: url ? { url, observedAt: new Date().toISOString() } : { observedAt: new Date().toISOString() } };
    });
    setPending(true); setMessage('');
    const response = await fetch('/api/competitor-metrics/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows }) });
    const result = await response.json() as { error?: string; written?: number };
    setPending(false); setMessage(result.error || `${result.written || 0} competitor metric points imported.`);
    if (response.ok) { (event.target as HTMLFormElement).reset(); router.refresh(); }
  }

  return <div className="settings-grid"><form className="metric-import" onSubmit={createCompetitor}><h3>Add a tracked competitor</h3><div><label>Product<select name="productId" defaultValue=""><option value="">Portfolio-wide</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Name<input name="name" required minLength={2} placeholder="Acme Analytics" /></label></div><label>Domain<input name="domain" placeholder="acme.example" /></label><footer><small>Competitors and their evidence remain isolated to this workspace.</small><button className="app-primary" disabled={pending}>{pending ? 'Saving…' : 'Add competitor'}</button></footer></form><form className="metric-import" onSubmit={importMetrics}><h3>Import competitor evidence</h3><div><label>Competitor<select name="competitorId" required disabled={!competitors.length}>{competitors.map((competitor) => <option value={competitor.id} key={competitor.id}>{competitor.name}{competitor.domain ? ` · ${competitor.domain}` : ''}</option>)}</select></label><label>Source<input name="source" required defaultValue="manual" placeholder="semrush" /></label></div><label>Evidence rows<textarea name="rows" required rows={7} placeholder={'2026-08-20,organic_clicks,1840,https://source.example/report\n2026-08-20,estimated_traffic,12400\n2026-08-20,domain_rating,46'} /></label><footer><small>YYYY-MM-DD, metric_name, numeric_value, optional source URL. URLs are preserved as provenance for agent citations.</small><button className="app-primary" disabled={!competitors.length || pending}>{pending ? 'Importing…' : 'Import evidence'}</button></footer></form>{message && <p className="form-message" role="status">{message}</p>}</div>;
}
