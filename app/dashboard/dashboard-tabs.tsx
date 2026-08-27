'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';

export type DashboardTab = { id: string; label: string; description?: string; content: ReactNode };

export function DashboardTabs({ tabs, initialTab }: { tabs: DashboardTab[]; initialTab?: string }) {
  const first = tabs.some((tab) => tab.id === initialTab) ? initialTab! : tabs[0]?.id;
  const [active, setActive] = useState(first);
  const activeTab = tabs.find((tab) => tab.id === active) || tabs[0];

  function select(id: string) {
    setActive(id);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
  }

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    select(tabs[nextIndex].id);
    (event.currentTarget.parentElement?.children[nextIndex] as HTMLButtonElement | undefined)?.focus();
  }

  return <div className="dashboard-tabs">
    <div className="dashboard-tab-list" role="tablist" aria-label="Page sections">
      {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" tabIndex={active === tab.id ? 0 : -1} aria-selected={active === tab.id} aria-controls={`dashboard-tab-panel-${tab.id}`} id={`dashboard-tab-${tab.id}`} onClick={() => select(tab.id)} onKeyDown={(event) => move(event, index)}><strong>{tab.label}</strong>{tab.description && <small>{tab.description}</small>}</button>)}
    </div>
    {activeTab && <section className="dashboard-tab-panel" id={`dashboard-tab-panel-${activeTab.id}`} role="tabpanel" aria-labelledby={`dashboard-tab-${activeTab.id}`} key={activeTab.id}>{activeTab.content}</section>}
  </div>;
}
