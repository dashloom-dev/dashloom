'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Member = { userId: string; name: string; email: string };
type Action = { id: string; status: string; assignedUserId: string | null; dueAt: string | null; dismissedReason: string | null };
const transitions: Record<string, string[]> = { suggested: ['suggested', 'planned', 'dismissed'], planned: ['planned', 'in_progress', 'done', 'dismissed'], in_progress: ['in_progress', 'planned', 'done', 'dismissed'], done: ['done', 'in_progress'], dismissed: ['dismissed', 'planned'] };
const labels: Record<string, string> = { suggested: 'Suggested', planned: 'Planned', in_progress: 'In progress', done: 'Done', dismissed: 'Dismissed' };

export function ActionControls({ action, members }: { action: Action; members: Member[] }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setPending(true); const due = String(values.get('dueAt') || '');
    const response = await fetch('/api/agent-actions', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: action.id, status: values.get('status'), assignedUserId: values.get('assignedUserId') || null, dueAt: due ? new Date(`${due}T23:59:59.000Z`).toISOString() : null, dismissedReason: values.get('status') === 'dismissed' ? values.get('dismissedReason') : null }) });
    const result = await response.json() as { error?: string; warning?: string; outcomeStatus?: string }; setPending(false); setMessage(result.error || result.warning || (result.outcomeStatus === 'captured' ? 'Action completed. Its metric baseline is now frozen for follow-up.' : 'Action updated.')); if (response.ok) router.refresh();
  }
  return <form className="action-controls" onSubmit={submit}>
    <label>Status<select name="status" defaultValue={action.status}>{(transitions[action.status] || [action.status]).map((status) => <option value={status} key={status}>{labels[status] || status}</option>)}</select></label>
    <label>Owner<select name="assignedUserId" defaultValue={action.assignedUserId || ''}><option value="">Unassigned</option>{members.map((member) => <option value={member.userId} key={member.userId}>{member.name} · {member.email}</option>)}</select></label>
    <label>Due date (UTC)<input name="dueAt" type="date" defaultValue={action.dueAt?.slice(0, 10) || ''} /></label>
    <label>Dismissal reason<input name="dismissedReason" maxLength={500} defaultValue={action.dismissedReason || ''} placeholder="Required only when dismissed" /></label>
    <button className="app-primary" disabled={pending}>{pending ? 'Saving…' : 'Update action'}</button>{message && <small role="status">{message}</small>}
  </form>;
}
