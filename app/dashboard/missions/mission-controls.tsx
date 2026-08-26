'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function MissionRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
  async function refresh() { setPending(true); const response = await fetch('/api/agent-missions/refresh', { method: 'POST' }); const result = await response.json() as { error?: string; measured?: number; achieved?: number; missed?: number }; setPending(false); setMessage(result.error || `${result.measured || 0} measurements refreshed · ${result.achieved || 0} achieved · ${result.missed || 0} missed`); if (response.ok) router.refresh(); }
  return <div className="mission-refresh"><button className="app-secondary" type="button" disabled={!enabled || pending} onClick={refresh}>{pending ? 'Refreshing…' : 'Refresh progress'}</button>{message && <small role="status">{message}</small>}</div>;
}

export function MissionCancel({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
  async function cancel() { setPending(true); const response = await fetch('/api/agent-missions', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status: 'cancelled' }) }); const result = await response.json() as { error?: string }; setPending(false); setMessage(result.error || 'Mission cancelled.'); if (response.ok) router.refresh(); }
  return <div className="mission-cancel"><button type="button" disabled={!enabled || pending} onClick={cancel}>{pending ? 'Cancelling…' : 'Cancel mission'}</button>{message && <small role="status">{message}</small>}</div>;
}
