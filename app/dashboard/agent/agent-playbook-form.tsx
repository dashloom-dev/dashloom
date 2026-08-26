'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AgentPlaybook } from '@/lib/agent-playbook';

const priorityOptions = [
  ['revenue', 'Revenue'], ['growth', 'Growth'], ['retention', 'Retention'], ['seo', 'SEO'], ['reliability', 'Reliability'], ['delivery', 'Delivery'], ['client_outcomes', 'Client outcomes'],
] as const;

export function AgentPlaybookForm({ preset, playbook, canManage }: { preset: string; playbook: AgentPlaybook; canManage: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const priorities = form.getAll('priorities').map(String);
    const response = await fetch('/api/agent/profiles', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preset, playbook: { version: 2, businessModel: form.get('businessModel'), primaryObjective: form.get('primaryObjective'), priorities, changeSensitivity: form.get('changeSensitivity'), responseStyle: form.get('responseStyle'), language: form.get('language') } }) });
    const result = await response.json() as { error?: string };
    setPending(false);
    setMessage(result.error || 'Playbook saved. New runs will freeze this configuration in their evidence snapshot.');
    if (response.ok) router.refresh();
  }

  return <section className="agent-playbook">
    <header><div><span>AGENT PLAYBOOK</span><h2>Teach this analyst how you operate</h2><p>Structured preferences shape prioritization and presentation without weakening evidence, citation, or safety rules.</p></div><b>{preset.replaceAll('_', ' ')}</b></header>
    <form onSubmit={submit}>
      <div className="playbook-grid">
        <label>Business model<select name="businessModel" defaultValue={playbook.businessModel} disabled={!canManage}><option value="indie_hacker">Independent portfolio</option><option value="saas">SaaS business</option><option value="agency">Agency / client services</option><option value="internal_platform">Internal platform</option><option value="private_self_hosted">Private self-hosted</option></select></label>
        <label>Change sensitivity<select name="changeSensitivity" defaultValue={playbook.changeSensitivity} disabled={!canManage}><option value="high">High · surface smaller changes</option><option value="standard">Standard · balance signal and noise</option><option value="low">Low · only material changes</option></select></label>
        <label>Response style<select name="responseStyle" defaultValue={playbook.responseStyle} disabled={!canManage}><option value="concise">Concise</option><option value="executive">Executive brief</option><option value="detailed">Detailed analysis</option></select></label>
        <label>Output language<select name="language" defaultValue={playbook.language} disabled={!canManage}><option value="auto">Match the question</option><option value="en">English</option><option value="zh">简体中文</option></select></label>
      </div>
      <label>Primary operating objective<textarea name="primaryObjective" required minLength={3} maxLength={240} rows={3} defaultValue={playbook.primaryObjective} disabled={!canManage} /></label>
      <fieldset><legend>Priorities · choose 1–5</legend><div className="playbook-priorities">{priorityOptions.map(([value, label]) => <label key={value}><input type="checkbox" name="priorities" value={value} defaultChecked={playbook.priorities.includes(value)} disabled={!canManage} /> <span>{label}</span></label>)}</div></fieldset>
      <footer><small>{message || (canManage ? 'Only owners and admins can change the shared operating brief. Existing evidence snapshots remain unchanged.' : 'Owner or admin access is required to change the shared operating brief.')}</small><button className="app-primary" disabled={!canManage || pending}>{pending ? 'Saving…' : 'Save playbook'}</button></footer>
    </form>
  </section>;
}
