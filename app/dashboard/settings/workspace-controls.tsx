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
    setMessage(result.error || (form.get('locale') === 'zh' ? '已保存。' : 'Saved.'));
    if (response.ok) {
      document.documentElement.lang = form.get('locale') === 'zh' ? 'zh-CN' : 'en';
      router.refresh();
    }
  }

  return <form className="connector-form" onSubmit={update}>
    <h2>{zh ? '工作空间默认设置' : 'Workspace defaults'}</h2>
    <div className="settings-grid">
      <label>{zh ? '名称' : 'Name'}<input name="name" required defaultValue={active.name} /></label>
      <label>{zh ? '语言' : 'Locale'}<select name="locale" defaultValue={active.locale}><option value="en">English</option><option value="zh">简体中文</option></select></label>
      <label>{zh ? 'IANA 时区' : 'IANA timezone'}<input name="timezone" required defaultValue={active.timezone} /></label>
      <label>{zh ? '你的角色' : 'Your role'}<input value={active.role} readOnly /></label>
    </div>
    <footer><small>{zh ? '语言控制控制台导航与核心页面；时区控制定时报告。' : 'Locale controls dashboard navigation and core pages. Timezone controls scheduled reports.'}</small><button className="app-primary" disabled={pending || !['owner', 'admin'].includes(active.role)}>{pending ? (zh ? '保存中…' : 'Saving…') : (zh ? '保存工作空间' : 'Save workspace')}</button></footer>
    {message && <p className="form-message" role="status">{message}</p>}
  </form>;
}
