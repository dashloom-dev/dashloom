'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type ProductOption = { id: string; name: string };

export function MetricImportForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const productId = String(form.get('productId'));
    const source = String(form.get('source'));
    const lines = String(form.get('rows')).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const rows = lines.map((line) => {
      const [metricDate, metric, value] = line.split(',').map((item) => item.trim());
      return { productId, source, metricDate, metric, value: Number(value) };
    });
    setPending(true); setMessage('');
    const response = await fetch('/api/metrics/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows }) });
    const result = await response.json() as { error?: string; written?: number };
    setPending(false);
    setMessage(result.error || `${result.written || 0} metric points imported.`);
    if (response.ok) { (event.target as HTMLFormElement).reset(); router.refresh(); }
  }
  return <form className="metric-import" onSubmit={submit}><div><label>Product<select name="productId" required disabled={!products.length}>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Source<select name="source" defaultValue="custom"><option value="custom">Custom</option><option value="revenue">Revenue</option><option value="product">Product analytics</option><option value="competitor">Competitor</option></select></label></div><label>Metric rows<textarea name="rows" required rows={7} placeholder={'2026-08-20,active_users,184\n2026-08-20,revenue,1299.50\n2026-08-21,active_users,201'} /></label><footer><small>One row per metric: YYYY-MM-DD, metric_name, numeric_value. Existing identical points are updated.</small><button className="app-primary" disabled={!products.length || pending}>{pending ? 'Importing…' : 'Import metrics'}</button></footer>{message && <p className="form-message" role="status">{message}</p>}</form>;
}
