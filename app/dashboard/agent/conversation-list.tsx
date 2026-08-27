'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Conversation = { id: string; title: string; agentPreset: string; lastMessageAt: string; scopeLabel?: string };
export function ConversationList({ conversations, activeId }: { conversations: Conversation[]; activeId?: string }) { const router = useRouter(); const [pending, setPending] = useState<string | null>(null); async function archive(id: string) { setPending(id); const response = await fetch('/api/agent/conversations', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status: 'archived' }) }); setPending(null); if (response.ok) { if (activeId === id) router.push('/dashboard/agent'); router.refresh(); } }
  return <section className="conversation-list"><header><h2>Conversations</h2><Link href="/dashboard/agent">New</Link></header>{conversations.map((item) => <article key={item.id} data-active={item.id === activeId}><Link href={`/dashboard/agent?conversation=${item.id}`}><strong>{item.title}</strong><small>{item.scopeLabel ? `${item.scopeLabel} · ` : ''}{item.agentPreset.replaceAll('_', ' ')} · {item.lastMessageAt.slice(0, 10)}</small></Link><button type="button" aria-label={`Archive ${item.title}`} disabled={pending === item.id} onClick={() => archive(item.id)}>×</button></article>)}{!conversations.length && <p>No conversation yet.</p>}</section>;
}
