'use client';

import { FormEvent, useMemo, useState, useSyncExternalStore } from 'react';

type Product = { id: string; name: string };
type Status = {
  product: Product;
  source: string | null;
  evidence: { pointCount: number; metricCount: number; latestMetricDate: string | null; lastCollectedAt: string | null };
  keyHealth: { activeKeys: number; productScopedKeys: number; lastUsedAt: string | null };
  agentReadiness: Record<string, { ready: boolean; evidencePoints: number }>;
};

export function ProductIngestionWizard({ products, canManage }: { products: Product[]; canManage: boolean }) {
  const first = products[0];
  const [productId, setProductId] = useState(first?.id || '');
  const [keyName, setKeyName] = useState(first ? `${first.name} production` : 'Production ingestion');
  const [source, setSource] = useState('custom');
  const [metric, setMetric] = useState('active_users');
  const [domain, setDomain] = useState('product');
  const [metricDate, setMetricDate] = useState(() => new Date().toISOString().slice(0, 10));
  const origin = useSyncExternalStore(() => () => undefined, () => window.location.origin, () => 'https://your-dashloom.example');
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const payload = useMemo(() => JSON.stringify({ rows: [{ productId: productId || 'PRODUCT_UUID', source, metric, metricDate, value: 'YOUR_REAL_AGGREGATE_VALUE', dimensions: { domain } }] }, null, 2).replace('"YOUR_REAL_AGGREGATE_VALUE"', 'YOUR_REAL_AGGREGATE_VALUE'), [domain, metric, metricDate, productId, source]);
  const command = `curl "${origin}/api/ingest/v1/metrics" \\\n  -H "Authorization: Bearer \$DASHLOOM_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  --data '${payload}'`;

  function chooseProduct(id: string) {
    const product = products.find((item) => item.id === id);
    setProductId(id); setKeyName(product ? `${product.name} production` : 'Production ingestion'); setSecret(''); setStatus(null); setMessage('');
  }
  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setSecret(''); setMessage('');
    const response = await fetch('/api/ingestion-keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: keyName, productId }) });
    const result = await response.json() as { error?: string; key?: { token: string } };
    setPending(false); setMessage(result.error || 'Product-scoped key created. Copy it now; Dashloom cannot show it again.');
    if (result.key) setSecret(result.key.token);
  }
  async function verify() {
    setPending(true); setMessage('Checking stored evidence and key usage…');
    const response = await fetch(`/api/ingestion-status?productId=${encodeURIComponent(productId)}&source=${encodeURIComponent(source)}`, { cache: 'no-store' });
    const result = await response.json() as Status & { error?: string };
    setPending(false); setMessage(result.error || (result.evidence.pointCount ? 'Real evidence found for this product and source.' : 'No matching evidence yet. Run your server-side sender, then verify again.'));
    if (response.ok) setStatus(result);
  }
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`); }
    catch { setMessage(`Could not copy ${label.toLowerCase()}; select it manually.`); }
  }

  if (!products.length) return <section className="app-panel ingestion-wizard"><div className="panel-empty"><p>Add a real product first. Dashloom will not create demo products or mix sample metrics into your workspace.</p><a href="/dashboard/products">Add product →</a></div></section>;
  const readyAgents = status ? Object.values(status.agentReadiness).filter((item) => item.ready).length : 0;
  return <section className="app-panel ingestion-wizard">
    <div className="panel-title"><div><span>DIRECT PRODUCT INGESTION</span><h2>Connect a real product in three steps</h2></div><span className="status-pill">write only · product scoped</span></div>
    <div className="ingestion-steps">
      <form onSubmit={createKey}><header><b>1</b><div><h3>Choose scope and create a key</h3><p>The new secret can write metrics only for the selected product.</p></div></header><label>Product<select value={productId} onChange={(event) => chooseProduct(event.target.value)}>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Key name<input value={keyName} onChange={(event) => setKeyName(event.target.value)} required minLength={2} maxLength={80} /></label><button className="app-primary" disabled={!canManage || pending}>{pending ? 'Working…' : 'Create product key'}</button>{!canManage && <small>Owner or Admin access is required to create a key.</small>}</form>
      <div><header><b>2</b><div><h3>Send your aggregate</h3><p>Keep the secret server-side. Replace the value placeholder with a real aggregate from your product.</p></div></header><div className="ingestion-fields"><label>Source<input value={source} onChange={(event) => setSource(event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40))} pattern="[a-z][a-z0-9_-]{1,39}" /></label><label>Metric<input value={metric} onChange={(event) => setMetric(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 80))} pattern="[a-z][a-z0-9_]{1,79}" /></label><label>Domain<select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="product">Product</option><option value="commercial">Commercial</option><option value="acquisition">Acquisition</option><option value="search">Search</option><option value="delivery">Delivery</option><option value="operations">Operations</option></select></label><label>Metric date<input type="date" value={metricDate} onChange={(event) => setMetricDate(event.target.value)} /></label></div>{secret && <div className="ingestion-secret"><strong>Copy secret once</strong><input readOnly value={secret} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={() => copy(secret, 'Secret')}>Copy</button></div>}<pre><code>{command}</code></pre><button className="app-secondary" type="button" onClick={() => copy(command, 'Command')}>Copy command</button>
      </div>
      <div><header><b>3</b><div><h3>Verify real evidence</h3><p>Dashloom checks persisted points, key use, and specialist readiness. It never inserts a test point for you.</p></div></header><button className="app-primary" type="button" disabled={pending} onClick={verify}>{pending ? 'Checking…' : 'Verify connection'}</button>{status && <dl><div><dt>Matching points</dt><dd>{status.evidence.pointCount}</dd></div><div><dt>Metrics</dt><dd>{status.evidence.metricCount}</dd></div><div><dt>Latest source date</dt><dd>{status.evidence.latestMetricDate || 'Waiting'}</dd></div><div><dt>Product keys</dt><dd>{status.keyHealth.productScopedKeys}</dd></div><div><dt>Ready analysts</dt><dd>{readyAgents} / 5</dd></div></dl>}</div>
    </div>{message && <p className="form-message" role="status">{message}</p>}
  </section>;
}
