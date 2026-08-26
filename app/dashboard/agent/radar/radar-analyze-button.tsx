'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RadarAnalyzeButton({ preset, question, productId, ready, canAnalyze }: { preset: string; question: string; productId: string | null; ready: boolean; canAnalyze: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function analyze() {
    setPending(true); setMessage('Freezing current evidence…');
    try {
      const response = await fetch('/api/agent/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preset, question, productId }) });
      const result = await response.json() as { error?: string; conversationId?: string };
      if (!response.ok || !result.conversationId) { setMessage(result.error || 'The Agent could not analyze this signal.'); return; }
      router.push(`/dashboard/agent?conversation=${result.conversationId}`);
      router.refresh();
    } catch {
      setMessage('The Agent could not analyze this signal. Check the connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return <div className="radar-analysis-control"><button type="button" className="app-primary" disabled={!ready || !canAnalyze || pending} onClick={analyze}>{pending ? 'Analyzing…' : 'Analyze signal'}</button>{message && <small role="status">{message}</small>}</div>;
}
