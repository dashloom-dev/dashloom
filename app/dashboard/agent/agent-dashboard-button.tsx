'use client';

import { useState } from 'react';

export function AgentDashboardButton({ analysisRunId }: { analysisRunId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function create() {
    setPending(true); setMessage('');
    const response = await fetch('/api/agent/dashboards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ analysisRunId }) });
    const result = await response.json() as { error?: string; view?: { url: string } };
    setPending(false);
    if (response.ok && result.view) window.location.assign(result.view.url);
    else setMessage(result.error || 'Smart dashboard could not be created.');
  }
  return <span className="agent-dashboard-action"><button type="button" onClick={create} disabled={pending}>{pending ? 'Building dashboard…' : 'Create smart dashboard'}</button>{message && <small role="status">{message}</small>}</span>;
}
