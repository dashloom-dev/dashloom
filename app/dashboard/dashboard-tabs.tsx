'use client';

import { useState, type ReactNode } from 'react';

export type DashboardTab = { id: string; label: string; description?: string; content: ReactNode };

export function DashboardTabs({ tabs, initialTab }: { tabs: DashboardTab[]; initialTab?: string }) {
  const first = tabs.some((tab) => tab.id === initialTab) ? initialTab! : tabs[0]?.id;
  const [active, setActive] = useState(first);

  return <div className="dashboard-tabs">
    <div className="dashboard-tab-list" role="tablist" aria-label="Page sections">
      {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} aria-controls={`dashboard-tab-panel-${tab.id}`} id={`dashboard-tab-${tab.id}`} onClick={() => { setActive(tab.id); window.history.replaceState(null, '', `${window.location.pathname}#${tab.id}`); }}><strong>{tab.label}</strong>{tab.description && <small>{tab.description}</small>}</button>)}
    </div>
    {tabs.map((tab) => <section className="dashboard-tab-panel" id={`dashboard-tab-panel-${tab.id}`} role="tabpanel" aria-labelledby={`dashboard-tab-${tab.id}`} hidden={active !== tab.id} key={tab.id}>{tab.content}</section>)}
  </div>;
}
