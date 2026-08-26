'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Product = { id: string; name: string; domain: string | null; category: string | null; status: 'active' | 'paused' | 'archived' };
type ImpactItem = { key: string; label: string; count: number };
type DeletionImpact = { deleted: ImpactItem[]; detached: ImpactItem[]; deletedTotal: number; detachedTotal: number };

export function ProductForm({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: form.get('name'), domain: form.get('domain'), category: form.get('category') }),
    });
    const result = await response.json() as { error?: string };
    setPending(false);
    if (!response.ok) return setMessage(result.error || 'Could not add this product.');
    (event.target as HTMLFormElement).reset();
    setMessage('Product added. Connect its data sources next.');
    router.refresh();
  }

  return <form className="product-form" onSubmit={submit}>
    <label>Product name<input name="name" minLength={2} maxLength={80} required disabled={!canManage} placeholder="Nimbus Analytics" /></label>
    <label>Domain<input name="domain" maxLength={255} disabled={!canManage} placeholder="nimbus.example" /></label>
    <label>Category<input name="category" maxLength={80} disabled={!canManage} placeholder="Analytics" /></label>
    <button className="app-primary" disabled={!canManage || pending}>{pending ? 'Adding…' : 'Add product'}</button>
    {!canManage && <p className="form-message" role="status">Owner or admin access is required to manage products.</p>}
    {message && <p className="form-message" role="status">{message}</p>}
  </form>;
}

export function ProductLifecycleControls({ products, canManage, canDelete }: { products: Product[]; canManage: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletion, setDeletion] = useState<{ product: Product; impact: DeletionImpact } | null>(null);
  const [confirmName, setConfirmName] = useState('');

  async function update(event: FormEvent<HTMLFormElement>, product: Product) {
    event.preventDefault();
    setPending(true); setMessage('Saving product changes…');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/products/${product.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update', name: form.get('name'), domain: form.get('domain'), category: form.get('category') }) });
    const result = await response.json() as { error?: string };
    setPending(false); setMessage(result.error || 'Product updated.');
    if (response.ok) { setEditingId(null); router.refresh(); }
  }

  async function setStatus(product: Product, status: Product['status']) {
    if (status === 'archived' && !window.confirm(`Archive “${product.name}”? Its configuration and historical data remain stored, and you can restore it later.`)) return;
    setPending(true); setMessage(`${status === 'active' ? 'Restoring' : status === 'paused' ? 'Pausing' : 'Archiving'} product…`);
    const response = await fetch(`/api/products/${product.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'set_status', status }) });
    const result = await response.json() as { error?: string };
    setPending(false); setMessage(result.error || `Product ${status}.`);
    if (response.ok) router.refresh();
  }

  async function reviewDeletion(product: Product) {
    setPending(true); setMessage('Calculating deletion impact…');
    const response = await fetch(`/api/products/${product.id}`);
    const result = await response.json() as { error?: string; impact?: DeletionImpact };
    setPending(false);
    if (!response.ok || !result.impact) return setMessage(result.error || 'Could not calculate deletion impact.');
    setMessage(''); setConfirmName(''); setDeletion({ product, impact: result.impact });
  }

  async function remove() {
    if (!deletion) return;
    setPending(true);
    const response = await fetch(`/api/products/${deletion.product.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmName }) });
    const result = await response.json() as { error?: string };
    setPending(false);
    if (!response.ok) return setMessage(result.error || 'Could not delete this product.');
    setDeletion(null); setMessage('Product and linked operational data deleted. Historical records were retained without the product link.'); router.refresh();
  }

  return <>
    {message && <p className="product-lifecycle-message" role="status">{message}</p>}
    <section className="products-table">
      <article className="header"><span>Product</span><span>Domain</span><span>Category</span><span>Status</span><span>Actions</span></article>
      {products.map((product) => <div className="product-lifecycle-row" key={product.id}>
        <article><strong>{product.name}</strong><span>{product.domain || 'Not set'}</span><span>{product.category || 'Uncategorized'}</span><span><i className="source-dot" data-status={product.status} />{product.status}</span><span className="product-row-actions">{canManage && <><button type="button" disabled={pending} onClick={() => setEditingId(editingId === product.id ? null : product.id)}>Edit</button>{product.status === 'active' && <button type="button" disabled={pending} onClick={() => setStatus(product, 'paused')}>Pause</button>}{product.status === 'paused' && <button type="button" disabled={pending} onClick={() => setStatus(product, 'active')}>Activate</button>}{product.status !== 'archived' && <button type="button" disabled={pending} onClick={() => setStatus(product, 'archived')}>Archive</button>}{product.status === 'archived' && <button type="button" disabled={pending} onClick={() => setStatus(product, 'active')}>Restore</button>}</>}{canDelete && <button className="danger" type="button" disabled={pending} onClick={() => reviewDeletion(product)}>Delete</button>}</span></article>
        {editingId === product.id && <form className="product-edit-panel" onSubmit={(event) => update(event, product)}>
          <label>Name<input name="name" required minLength={2} maxLength={80} defaultValue={product.name} /></label><label>Domain<input name="domain" maxLength={255} defaultValue={product.domain || ''} /></label><label>Category<input name="category" maxLength={80} defaultValue={product.category || ''} /></label><footer><button className="app-secondary" type="button" onClick={() => setEditingId(null)}>Cancel</button><button className="app-primary" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button></footer>
        </form>}
      </div>)}
      {!products.length && <div className="panel-empty"><p>No products yet. Add the first product above; no demo data will be mixed into your workspace.</p></div>}
    </section>
    {deletion && <div className="product-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setDeletion(null); }}><section className="product-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="product-delete-title">
      <span>PERMANENT DELETION</span><h2 id="product-delete-title">Delete {deletion.product.name}?</h2><p>This cannot be undone. The following product-owned operational data will be permanently deleted:</p>
      <ImpactList items={deletion.impact.deleted} empty="No linked operational records were found." />
      <p>Historical records remain auditable, but their product link will be removed:</p><ImpactList items={deletion.impact.detached} empty="No historical records need to be detached." />
      <label>Type <code>{deletion.product.name}</code> to confirm<input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} autoFocus /></label>
      <footer><button className="app-secondary" type="button" disabled={pending} onClick={() => setDeletion(null)}>Cancel</button><button className="product-delete-confirm" type="button" disabled={pending || confirmName !== deletion.product.name} onClick={remove}>{pending ? 'Deleting…' : 'Delete permanently'}</button></footer>
    </section></div>}
  </>;
}

function ImpactList({ items, empty }: { items: ImpactItem[]; empty: string }) {
  const visible = items.filter((item) => item.count > 0);
  return visible.length ? <ul>{visible.map((item) => <li key={item.key}><strong>{item.count.toLocaleString()}</strong> {item.label}</li>)}</ul> : <p className="product-impact-empty">{empty}</p>;
}
