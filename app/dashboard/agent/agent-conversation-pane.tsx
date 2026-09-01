'use client';

import { useEffect, useState, type ReactNode } from 'react';

export const agentNewConversationEvent = 'dashloom:agent-new-conversation';
export const agentBeforeNewConversationEvent = 'dashloom:before-agent-new-conversation';
export const agentRestoreConversationEvent = 'dashloom:agent-restore-conversation';

export function AgentConversationPane({ active, fresh, hasActive }: { active: ReactNode; fresh: ReactNode; hasActive: boolean }) {
  const [showFresh, setShowFresh] = useState(!hasActive);
  useEffect(() => {
    const showNew = () => setShowFresh(true);
    const restore = () => setShowFresh(false);
    const syncWithHistory = () => setShowFresh(!new URLSearchParams(window.location.search).has('conversation'));
    window.addEventListener(agentNewConversationEvent, showNew);
    window.addEventListener(agentRestoreConversationEvent, restore);
    window.addEventListener('popstate', syncWithHistory);
    return () => {
      window.removeEventListener(agentNewConversationEvent, showNew);
      window.removeEventListener(agentRestoreConversationEvent, restore);
      window.removeEventListener('popstate', syncWithHistory);
    };
  }, []);
  return showFresh ? fresh : active;
}
