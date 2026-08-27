'use client';

import { ChevronUp, Globe2, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

type Props = { user: { name: string; email: string }; workspace: { name: string; locale: string; timezone: string } | null };

export function DashboardAccountMenu({ user, workspace }: Props) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState(workspace?.locale || 'en');
  const [pending, setPending] = useState(false);
  const zh = locale === 'zh';

  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);

  async function changeLocale(next: string) {
    if (!workspace || next === locale) return;
    setLocale(next); setPending(true);
    const response = await fetch('/api/workspace', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: workspace.name, locale: next, timezone: workspace.timezone }) });
    setPending(false);
    if (!response.ok) { setLocale(locale); return; }
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
    window.dispatchEvent(new CustomEvent('dashloom:locale', { detail: next }));
    router.refresh();
  }

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.push('/login');
    router.refresh();
  }

  return <div className="dashboard-sidebar-footer" ref={root}>
    <label className="dashboard-locale"><Globe2 size={17} /><span>{zh ? '界面语言' : 'Language'}</span><select aria-label={zh ? '界面语言' : 'Interface language'} value={locale} disabled={pending || !workspace} onChange={(event) => changeLocale(event.target.value)}><option value="zh">简体中文</option><option value="en">English</option></select></label>
    <div className="dashboard-account">
      {open && <div className="dashboard-account-popover" role="menu"><div><strong>{user.name}</strong><small>{user.email}</small></div><button type="button" role="menuitem" disabled={pending} onClick={signOut}><LogOut size={17} />{zh ? '退出登录' : 'Sign out'}</button></div>}
      <button className="product-user" type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}><i>{user.name.slice(0, 2).toUpperCase()}</i><span><strong>{user.name}</strong><small>{user.email}</small></span><ChevronUp className="account-chevron" size={17} /></button>
    </div>
  </div>;
}
