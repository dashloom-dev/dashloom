'use client';

import { BookOpen, ChevronUp, Globe2, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

type Props = { user: { name: string; email: string }; locale: 'en' | 'zh' };

export function DashboardAccountMenu({ user, locale }: Props) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const zh = locale === 'zh';

  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.push('/login');
  }

  return <div className="dashboard-sidebar-footer" ref={root}>
    <div className="dashboard-footer-tools">
      <div className="dashboard-locale dashboard-locale-static"><Globe2 size={17} /><span>{zh ? '简体中文' : 'English'}</span></div>
      <a className="dashboard-docs-link" href="https://github.com/dashloom-dev/dashloom#readme" target="_blank" rel="noreferrer" aria-label={zh ? '在 GitHub 打开文档' : 'Open documentation on GitHub'}><BookOpen size={17} /><span>{zh ? '文档' : 'Docs'}</span></a>
    </div>
    <div className="dashboard-account">
      {open && <div className="dashboard-account-popover" role="menu"><div><strong>{user.name}</strong><small>{user.email}</small></div><button type="button" role="menuitem" disabled={pending} onClick={signOut}><LogOut size={17} />{zh ? '退出登录' : 'Sign out'}</button></div>}
      <button className="product-user" type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}><i>{user.name.slice(0, 2).toUpperCase()}</i><span><strong>{user.name}</strong><small>{user.email}</small></span><ChevronUp className="account-chevron" size={17} /></button>
    </div>
  </div>;
}
