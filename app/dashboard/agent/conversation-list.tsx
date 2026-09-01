'use client';

import { useState } from 'react';
import Link from 'next/link';
import { agentBeforeNewConversationEvent, agentNewConversationEvent, agentRestoreConversationEvent } from './agent-conversation-pane';

type Conversation = { id: string; title: string; agentPreset: string; lastMessageAt: string; scopeLabel?: string };
export function ConversationList({ conversations, activeId, zh = false }: { conversations: Conversation[]; activeId?: string; zh?: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [showingNew, setShowingNew] = useState(!activeId);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState('');
  function showNewConversation(historyMode: 'push' | 'replace') {
    const url = new URL(window.location.href); url.search = ''; url.hash = '';
    if (historyMode === 'push') window.history.pushState(null, '', url.pathname); else window.history.replaceState(null, '', url.pathname);
    setPending(null); setShowingNew(true); window.dispatchEvent(new Event(agentNewConversationEvent));
  }
  function startNewConversation() {
    if (!window.dispatchEvent(new Event(agentBeforeNewConversationEvent, { cancelable: true }))) return;
    showNewConversation('push');
  }
  function restoreConversation(id: string) {
    const url = new URL(window.location.href); url.search = `?conversation=${encodeURIComponent(id)}`;
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    setShowingNew(false); window.dispatchEvent(new Event(agentRestoreConversationEvent));
  }
  async function archive(id: string) {
    const wasActive = !showingNew && activeId === id;
    if (wasActive && !window.dispatchEvent(new Event(agentBeforeNewConversationEvent, { cancelable: true }))) return;
    setError(''); setPending(id); setHiddenIds((current) => new Set(current).add(id));
    if (wasActive) showNewConversation('replace');
    try {
      const response = await fetch('/api/agent/conversations', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status: 'archived' }) });
      if (!response.ok) throw new Error('Archive request failed');
    } catch {
      setHiddenIds((current) => { const next = new Set(current); next.delete(id); return next; });
      if (wasActive) restoreConversation(id);
      setError(zh ? '归档失败，对话已恢复。请重试。' : 'Could not archive the conversation. It has been restored.');
    } finally { setPending(null); }
  }
  const visibleConversations = conversations.filter((item) => !hiddenIds.has(item.id));
  return <section className="conversation-list" aria-busy={Boolean(pending)}><header><h2>{zh ? '对话历史' : 'Conversations'}</h2><button type="button" onClick={startNewConversation}>＋ {zh ? '新建' : 'New'}</button></header>{error && <p className="conversation-list-error" role="alert">{error}</p>}{visibleConversations.map((item) => <article key={item.id} data-active={!showingNew && item.id === activeId}><Link href={`/dashboard/agent?conversation=${item.id}`} onClick={() => { setShowingNew(false); setPending(item.id); }}><strong>{item.title}</strong><small>{`${item.scopeLabel ? `${item.scopeLabel} · ` : ''}${item.agentPreset.replaceAll('_', ' ')} · ${item.lastMessageAt.slice(0, 10)}`}</small></Link><button type="button" aria-label={`${zh ? '归档' : 'Archive'} ${item.title}`} disabled={Boolean(pending)} onClick={() => archive(item.id)}>×</button></article>)}{!visibleConversations.length && <p>{zh ? '还没有对话。' : 'No conversation yet.'}</p>}</section>;
}
