'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';

export const agentNewConversationEvent = 'dashloom:agent-new-conversation';
export const agentBeforeNewConversationEvent = 'dashloom:before-agent-new-conversation';
export const agentRestoreConversationEvent = 'dashloom:agent-restore-conversation';
export const agentConversationSavedEvent = 'dashloom:agent-conversation-saved';

export function AgentConversationPane({ active, fresh, hasActive }: { active: ReactNode; fresh: ReactNode; hasActive: boolean }) {
  const [showFresh, setShowFresh] = useState(!hasActive);
  const [freshVersion, setFreshVersion] = useState(0);

  useEffect(() => {
    const showNew = () => { setFreshVersion((version) => version + 1); setShowFresh(true); };
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

  return showFresh ? <Fragment key={freshVersion}>{fresh}</Fragment> : active;
}
