'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OutcomeRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
  async function refresh() {
    setPending(true); setMessage('');
    const response = await fetch('/api/agent-actions/outcomes', { method: 'POST' });
    const result = await response.json() as { error?: string; measured?: number; awaiting?: number; repaired?: number };
    setPending(false); setMessage(result.error || `${result.measured || 0} updated · ${result.repaired || 0} fixed · ${result.awaiting || 0} waiting for newer data`);
    if (response.ok) router.refresh();
  }
  return <div className="outcome-refresh"><button className="app-secondary" type="button" disabled={!enabled || pending} onClick={refresh}>{pending ? 'Measuring…' : 'Refresh outcomes'}</button>{message && <small role="status">{message}</small>}</div>;
}
