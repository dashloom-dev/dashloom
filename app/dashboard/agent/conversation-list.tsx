'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { agentBeforeNewConversationEvent, agentNewConversationEvent, agentConversationSavedEvent } from './agent-conversation-pane';

type Conversation = { id: string; title: string; agentPreset: string; lastMessageAt: string; scopeLabel?: string };
export function ConversationList({ conversations, activeId, zh = false }: { conversations: Conversation[]; activeId?: string; zh?: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [showingNew, setShowingNew] = useState(!activeId);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState('');
  const [savedConversations, setSavedConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState(activeId);
  useEffect(() => {
    const saved = (event: Event) => {
      const conversation = (event as CustomEvent<Conversation>).detail;
      setSavedConversations((current) => {
        const existing = current.find((item) => item.id === conversation.id) || conversations.find((item) => item.id === conversation.id);
        return [{ ...conversation, title: existing?.title || conversation.title }, ...current.filter((item) => item.id !== conversation.id)];
      });
      setCurrentId(conversation.id);
      setShowingNew(false);
      setPending(null);
    };
    window.addEventListener(agentConversationSavedEvent, saved);
    return () => window.removeEventListener(agentConversationSavedEvent, saved);
  }, [conversations]);

  function showNewConversation(historyMode: 'push' | 'replace') {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    if (historyMode === 'push') window.history.pushState(null, '', url.pathname);
    else window.history.replaceState(null, '', url.pathname);
    setPending(null);
    setShowingNew(true);
    window.dispatchEvent(new Event(agentNewConversationEvent));
  }

  function startNewConversation() {
    if (!window.dispatchEvent(new Event(agentBeforeNewConversationEvent, { cancelable: true }))) return;
    showNewConversation('push');
  }

  async function archive(id: string) {
    const wasActive = !showingNew && currentId === id;
    if (wasActive && !window.dispatchEvent(new Event(agentBeforeNewConversationEvent, { cancelable: true }))) return;
    setError('');
    setPending(id);
    setHiddenIds((current) => new Set(current).add(id));
    try {
      const response = await fetch('/api/agent/conversations', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status: 'archived' }) });
      if (!response.ok) throw new Error('Archive request failed');
      if (wasActive) showNewConversation('replace');
    } catch {
      setHiddenIds((current) => { const next = new Set(current); next.delete(id); return next; });
      setError(zh ? '归档失败，对话已恢复。请重试。' : 'Could not archive the conversation. It has been restored.');
    } finally {
      setPending(null);
    }
  }

  const visibleConversations = [...savedConversations, ...conversations.filter((item) => !savedConversations.some((saved) => saved.id === item.id))].filter((item) => !hiddenIds.has(item.id));
  return <section className="conversation-list" aria-busy={Boolean(pending)}><header><h2>{zh ? '对话历史' : 'Conversations'}</h2><button type="button" onClick={startNewConversation}>＋ {zh ? '新建' : 'New'}</button></header>{error && <p className="conversation-list-error" role="alert">{error}</p>}{visibleConversations.map((item) => <article key={item.id} data-active={!showingNew && item.id === currentId}><Link href={`/dashboard/agent?conversation=${item.id}`} onClick={(event) => { if (!showingNew && item.id === currentId) { event.preventDefault(); return; } setShowingNew(false); setPending(item.id); }}><strong>{item.title}</strong><small>{`${item.scopeLabel ? `${item.scopeLabel} · ` : ''}${item.agentPreset.replaceAll('_', ' ')} · ${item.lastMessageAt.slice(0, 10)}`}</small></Link><button type="button" aria-label={`${zh ? '归档' : 'Archive'} ${item.title}`} disabled={Boolean(pending)} onClick={() => archive(item.id)}>×</button></article>)}{!visibleConversations.length && <p>{zh ? '还没有对话。' : 'No conversation yet.'}</p>}</section>;
}
