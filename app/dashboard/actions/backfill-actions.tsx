'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BackfillActions({ enabled }: { enabled: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
  async function backfill() { setPending(true); const response = await fetch('/api/agent-actions/backfill', { method: 'POST' }); const result = await response.json() as { error?: string; runs?: number; imported?: number; incompatible?: number; failed?: number }; setPending(false); setMessage(result.error || `Reviewed ${result.runs || 0} runs; ${result.imported || 0} validated findings are indexed, ${result.incompatible || 0} incompatible runs were skipped, and ${result.failed || 0} temporary failures remain retryable.`); if (response.ok) router.refresh(); }
  return <div className="action-backfill"><button className="app-secondary" type="button" disabled={!enabled || pending} onClick={backfill}>{pending ? 'Importing…' : 'Import recent findings'}</button>{message && <small role="status">{message}</small>}</div>;
}
