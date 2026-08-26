'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Account = { id: string; displayName: string; status: string; lastCheckedAt: string | null };
type Resource = { id: string; connectorAccountId: string; type: 'ga4' | 'gsc' | 'worker' | 'database' | 'custom'; resourceId: string; displayName: string; domainsJson: string };

export function GoogleControls({ accounts, resources, products, initialStatus }: { accounts: Account[]; resources: Resource[]; products: Array<{ id: string; name: string }>; initialStatus?: string }) {
  const router = useRouter();
  const googleResources = useMemo(() => resources.filter((resource) => resource.type === 'ga4' || resource.type === 'gsc'), [resources]);
  const [selected, setSelected] = useState(googleResources[0]?.id || '');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(initialStatus === 'connected' ? `${googleResources.length} Google resources discovered.` : initialStatus ? `Google connection status: ${initialStatus}.` : '');

  async function map(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const resource = googleResources.find((item) => item.id === selected); if (!resource) return;
    setPending(true); setMessage('Saving the product mapping…');
    const response = await fetch('/api/connectors/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: form.get('productId'), connectorAccountId: resource.connectorAccountId, source: resource.type, resourceId: resource.resourceId }) });
    const result = await response.json() as { error?: string }; setPending(false); setMessage(result.error || 'Google resource mapped to product.'); if (response.ok) router.refresh();
  }
  async function sync() { setPending(true); setMessage('Syncing GA4 and Search Console…'); const response = await fetch('/api/sync/google', { method: 'POST' }); const result = await response.json() as { error?: string; written?: number; errors?: string[] }; setPending(false); setMessage(result.error || `${result.written || 0} Google metric points synchronized${result.errors?.length ? `; ${result.errors.length} mappings need attention` : ''}.`); if (response.ok) router.refresh(); }

  return <section className="google-controls"><header><div><span>GOOGLE OAUTH</span><h3>{accounts.length ? `${accounts.length} connected Google account${accounts.length === 1 ? '' : 's'}` : 'Connect Analytics and Search Console'}</h3></div><a className="app-primary" href="/api/connectors/google/start">Connect Google account</a></header>
    {accounts.length > 0 && <div className="google-accounts">{accounts.map((account) => <article key={account.id}><strong>{account.displayName}</strong><span data-status={account.status}>{account.status}</span><small>{account.lastCheckedAt ? `Checked ${account.lastCheckedAt.slice(0, 10)}` : 'Not checked'}</small></article>)}</div>}
    <form onSubmit={map}><label>Product<select name="productId" required disabled={!products.length}>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Discovered resource<select value={selected} onChange={(event) => setSelected(event.target.value)} required disabled={!googleResources.length}>{googleResources.map((resource) => <option value={resource.id} key={resource.id}>{resource.type.toUpperCase()} · {resource.displayName}</option>)}</select></label><div><button className="app-secondary" type="button" disabled={pending || !accounts.length} onClick={sync}>Sync Google</button><button className="app-primary" disabled={pending || !selected || !products.length}>Save mapping</button></div></form>
    {message && <p className="form-message" role="status">{message}</p>}
  </section>;
}
