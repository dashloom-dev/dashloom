'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function WorkspaceControls({ active }: { active: { name: string; locale: string; timezone: string; role: string } }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const zh = active.locale === 'zh';

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const response = await fetch('/api/workspace', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
    const result = await response.json() as { error?: string };
    setPending(false);
    setMessage(result.error || (zh ? '已保存。' : 'Saved.'));
    if (response.ok) {
      router.refresh();
    }
  }

  return <form className="connector-form" onSubmit={update}>
    <h2>{zh ? '工作空间默认设置' : 'Workspace defaults'}</h2>
    <div className="settings-grid">
      <label>{zh ? '名称' : 'Name'}<input name="name" required defaultValue={active.name} /></label>
      <input type="hidden" name="locale" value={active.locale} />
      <label>{zh ? 'IANA 时区' : 'IANA timezone'}<input name="timezone" required defaultValue={active.timezone} /></label>
      <label>{zh ? '你的角色' : 'Your role'}<input value={active.role} readOnly /></label>
    </div>
    <footer><small>{zh ? '界面语言由部署变量 DASHLOOM_DEFAULT_LOCALE 决定；时区控制定时报告。' : 'Interface language is set at deployment with DASHLOOM_DEFAULT_LOCALE. Timezone controls scheduled reports.'}</small><button className="app-primary" disabled={pending || !['owner', 'admin'].includes(active.role)}>{pending ? (zh ? '保存中…' : 'Saving…') : (zh ? '保存工作空间' : 'Save workspace')}</button></footer>
    {message && <p className="form-message" role="status">{message}</p>}
  </form>;
}
