'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Provider = { id: string; displayName: string; provider: string; model: string; mode: string; status: string };
export function ProviderList({ providers, canManage }: { providers: Provider[]; canManage: boolean }) { const router = useRouter(); const [pending, setPending] = useState<string | null>(null); const [message, setMessage] = useState(''); async function disable(id: string) { if (!window.confirm('Disable this AI provider and permanently remove its stored credential? Historical run snapshots remain auditable.')) return; setPending(id); const response = await fetch(`/api/ai/providers?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); const result = await response.json() as { error?: string }; setPending(null); setMessage(result.error || 'Provider disabled and stored credential removed.'); if (response.ok) router.refresh(); }
  return <>{providers.map((provider) => <article className="report-row report-row-action" key={provider.id}><div><strong>{provider.displayName}</strong><small>{provider.provider} · {provider.model}</small></div><span>{provider.mode}</span><b data-status={provider.status}>{provider.status}</b><button type="button" className="report-deliver" disabled={!canManage || provider.status === 'disabled' || pending === provider.id} onClick={() => disable(provider.id)}>{pending === provider.id ? 'Removing…' : provider.status === 'disabled' ? 'Removed' : 'Disable'}</button></article>)}{!providers.length && <div className="panel-empty"><p>No model is connected. API keys will be encrypted at rest and never returned by read endpoints.</p></div>}{message && <p className="form-message" role="status">{message}</p>}</>;
}
