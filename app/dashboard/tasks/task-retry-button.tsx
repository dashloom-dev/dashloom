'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TaskRetryButton({ question, preset, conversationId, productId }: { question: string; preset: string; conversationId: string; productId: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function retry() {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/agent/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, preset, conversationId, productId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) setMessage(result.error || 'Retry could not be started.');
      else { setMessage('Retry completed. Refreshing task status…'); router.refresh(); }
    } catch {
      setMessage('Retry could not be started. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return <div className="task-retry-control"><button type="button" onClick={retry} disabled={pending}>{pending ? 'Retrying…' : 'Retry task'}</button>{message && <small>{message}</small>}</div>;
}
