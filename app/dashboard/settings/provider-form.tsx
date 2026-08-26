'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProviderForm({ returnTo, embedded = false }: { returnTo?: string; embedded?: boolean } = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('Validating the provider…');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/ai/providers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: form.get('displayName'), baseUrl: form.get('baseUrl'), apiKey: form.get('apiKey'), model: form.get('model') }) });
    const result = await response.json() as { error?: string; message?: string; provider?: { status: 'connected' | 'attention' } };
    setPending(false);
    setMessage(result.error || result.message || 'Provider saved.');
    if (response.ok && result.provider?.status === 'connected') {
      (event.target as HTMLFormElement).reset();
      if (returnTo) router.push(returnTo);
      router.refresh();
    }
  }
  return <form id="ai-provider" className={`settings-form provider-form${embedded ? ' provider-form-embedded' : ''}`} onSubmit={submit}>
    <div className="settings-grid"><label>Display name<input name="displayName" required placeholder="My OpenAI-compatible API" /></label><label>API base URL<input name="baseUrl" type="url" required defaultValue="https://api.openai.com/v1" /></label><label>Model<input name="model" required placeholder="gpt-5-mini" /></label><label>API key<input name="apiKey" type="password" autoComplete="new-password" required placeholder="Stored encrypted; never displayed again" /></label></div>
    <p>Dashloom validates <code>/models</code> before enabling the Agent. The key is encrypted server-side, never returned by the API, and can be removed by disabling the provider.</p>
    <button className="app-primary" disabled={pending}>{pending ? 'Validating…' : 'Connect provider'}</button>{message && <p className="form-message" role="status">{message}</p>}
  </form>;
}
