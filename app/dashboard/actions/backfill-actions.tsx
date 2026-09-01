'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BackfillActions({ enabled }: { enabled: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
  async function backfill() { setPending(true); const response = await fetch('/api/agent-actions/backfill', { method: 'POST' }); const result = await response.json() as { error?: string; runs?: number; imported?: number; incompatible?: number; failed?: number }; setPending(false); setMessage(result.error || `Checked ${result.runs || 0} reports: ${result.imported || 0} task items added, ${result.incompatible || 0} older reports skipped, and ${result.failed || 0} can be retried.`); if (response.ok) router.refresh(); }
  return <div className="action-backfill"><button className="app-secondary" type="button" disabled={!enabled || pending} onClick={backfill}>{pending ? 'Checking…' : 'Check older reports'}</button>{message && <small role="status">{message}</small>}</div>;
}
