'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Account = { id: string; displayName: string; status: string; lastCheckedAt: string | null };
type Resource = { id: string; connectorAccountId: string; type: string; resourceId: string; displayName: string };

export function BingControls({ accounts, resources, products }: { accounts: Account[]; resources: Resource[]; products: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const bingResources = useMemo(() => resources.filter((resource) => resource.type === 'bing_site'), [resources]);
  const [selected, setSelected] = useState(bingResources[0]?.id || '');
  const activeSelected = bingResources.some((resource) => resource.id === selected) ? selected : bingResources[0]?.id || '';
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage('Validating the API key and discovering verified Bing sites…');
    const response = await fetch('/api/connectors/bing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const result = await response.json() as { error?: string; discovered?: number; mapped?: number; firstSync?: { written?: number } | null };
    setPending(false);
    setMessage(result.error || `${result.discovered || 0} verified Bing sites discovered, ${result.mapped || 0} products auto-mapped${result.firstSync ? `, ${result.firstSync.written || 0} metric points synchronized` : ''}.`);
    if (response.ok) { (event.target as HTMLFormElement).reset(); router.refresh(); }
  }

  async function map(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resource = bingResources.find((item) => item.id === activeSelected);
    if (!resource) return;
    const form = new FormData(event.currentTarget); setPending(true); setMessage('Saving the Bing site mapping…');
    const response = await fetch('/api/connectors/bing', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: form.get('productId'), connectorAccountId: resource.connectorAccountId, resourceId: resource.resourceId }) });
    const result = await response.json() as { error?: string }; setPending(false); setMessage(result.error || 'Bing Webmaster site mapped to product.'); if (response.ok) router.refresh();
  }

  async function sync() {
    setPending(true); setMessage('Syncing Bing search, query, and page performance…');
    const response = await fetch('/api/sync/bing', { method: 'POST' });
    const result = await response.json() as { error?: string; written?: number; errors?: string[] }; setPending(false); setMessage(result.error || `${result.written || 0} Bing metric points synchronized${result.errors?.length ? `; ${result.errors.length} mappings need attention` : ''}.`); if (response.ok) router.refresh();
  }

  return <section className="google-controls"><header><div><span>BING WEBMASTER API</span><h3>{accounts.length ? `${accounts.length} connected Bing account${accounts.length === 1 ? '' : 's'}` : 'Connect Bing Webmaster'}</h3></div></header>
    <form className="connector-form" onSubmit={connect}><div className="settings-grid"><label>Connection name<input name="displayName" required placeholder="Acme Bing Webmaster" /></label><label>User API key<input name="apiKey" type="password" autoComplete="new-password" required minLength={16} placeholder="Bing Webmaster API key" /></label></div><footer><small>Generate one user-level key in Bing Webmaster Tools → Settings → API Access. Dashloom encrypts it and imports only verified sites and aggregated search evidence.</small><button className="app-primary" disabled={pending}>{pending ? 'Working…' : 'Connect Bing'}</button></footer></form>
    <form onSubmit={map}><label>Product<select name="productId" required disabled={!products.length}>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Discovered site<select value={activeSelected} onChange={(event) => setSelected(event.target.value)} required disabled={!bingResources.length}>{bingResources.map((resource) => <option value={resource.id} key={resource.id}>{resource.displayName}</option>)}</select></label><div><button className="app-secondary" type="button" disabled={pending || !accounts.length} onClick={sync}>Sync Bing</button><button className="app-primary" disabled={pending || !activeSelected || !products.length}>Save mapping</button></div></form>
    {message && <p className="form-message" role="status">{message}</p>}
  </section>;
}
