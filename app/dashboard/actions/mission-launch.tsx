'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Member = { userId: string; name: string; email: string };

export function MissionLaunch({ actionId, actionTitle, recommendedAction, members, launched }: { actionId: string; actionTitle: string; recommendedAction: string; members: Member[]; launched: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
  const actionPhrase = `${recommendedAction.charAt(0).toLowerCase()}${recommendedAction.slice(1)}`.replace(/[.!?]+$/, '');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setPending(true); setMessage('');
    const dueDate = String(values.get('dueAt') || '');
    const response = await fetch('/api/agent-missions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      actionId,
      title: values.get('title'),
      hypothesis: values.get('hypothesis'),
      targetDirection: values.get('targetDirection'),
      targetChangePercent: Number(values.get('targetChangePercent')),
      dueAt: new Date(`${dueDate}T23:59:59.000Z`).toISOString(),
      assignedUserId: values.get('assignedUserId') || null,
    }) });
    const result = await response.json() as { error?: string }; setPending(false);
    if (!response.ok) { setMessage(result.error || 'Follow-up could not be created.'); return; }
    router.push('/dashboard/missions'); router.refresh();
  }
  if (launched) return <div className="mission-launched"><strong>Follow-up started</strong><Link href="/dashboard/missions">View progress →</Link></div>;
  return <details className="mission-launch"><summary>Track a number after this task</summary><form onSubmit={submit}>
    <label>Follow-up name<input name="title" defaultValue={actionTitle} required minLength={2} maxLength={160} /></label>
    <label className="mission-hypothesis">What do you expect to happen?<textarea name="hypothesis" required minLength={10} maxLength={700} rows={3} defaultValue={`After we ${actionPhrase}, we expect the selected product number to move toward the target.`} /></label>
    <label>Target direction<select name="targetDirection" defaultValue="increase"><option value="increase">Increase</option><option value="decrease">Decrease</option></select></label>
    <label>Target change<input name="targetChangePercent" type="number" min="0.1" max="100" step="0.1" defaultValue="10" required /></label>
    <label>Due date (UTC)<input name="dueAt" type="date" required /></label>
    <label>Owner<select name="assignedUserId" defaultValue=""><option value="">Unassigned</option>{members.map((member) => <option value={member.userId} key={member.userId}>{member.name} · {member.email}</option>)}</select></label>
    <footer><small>Dashloom saves the current value, source, currency, and date. Later changes do not prove this task caused them.</small><button className="app-primary" disabled={pending}>{pending ? 'Starting…' : 'Start follow-up'}</button></footer>
    {message && <small className="form-message" role="status">{message}</small>}
  </form></details>;
}
