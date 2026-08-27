'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import type { DashloomLocale } from '@/lib/deployment-locale-value';
import { Brand } from '@/components/brand';

export function LoginForm({ next = '/dashboard', locale = 'en' }: { next?: string; locale?: DashloomLocale }) {
  const router = useRouter();
  const zh = locale === 'zh';
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const name = String(data.get('name') || '').trim();

    if (mode === 'forgot') {
      const result = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false); setError(result.error?.message || (zh ? '如果该邮箱存在，重置链接已发送。' : 'If this email exists, a reset link has been sent.')); return;
    }
    const result = mode === 'signup' ? await authClient.signUp.email({ email, password, name }) : await authClient.signIn.email({ email, password });

    setBusy(false);
    if (result.error) {
      setError(result.error.message || (zh ? '认证失败，请检查填写的信息。' : 'Authentication failed. Please check your details.'));
      return;
    }

    if (mode === 'signup' && !result.data?.token) {
      setMode('signin');
      setError(zh ? '账号已创建。请先通过邮件中的链接完成验证，再登录。' : 'Account created. Check your email for the verification link before signing in.');
      return;
    }

    router.push(next);
    router.refresh();
  }

  return <main className="auth-page" lang={zh ? 'zh-CN' : 'en'}>
    <section className="auth-intro">
      <Link className="brand" href={zh ? '/zh' : '/'}><Brand priority /></Link>
      <div><span>{zh ? 'AI 产品智能平台' : 'AI PRODUCT INTELLIGENCE'}</span><h1>{zh ? <>连接真实数据。<br />让 Agent<br />发现关键信号。</> : <>Connect the facts.<br />Let your Agent<br />find the signal.</>}</h1><p>{zh ? '把 Google、收入、搜索和业务数据汇总到同一证据层，帮助多产品运营者做出有依据的决策。' : 'Bring Google, revenue, search, and business data into one evidence layer built for operators managing multiple products.'}</p></div>
    </section>
    <section className="auth-panel">
      <form onSubmit={submit} className="auth-card">
        <span className="auth-kicker">{mode === 'signup' ? (zh ? '创建工作空间' : 'CREATE YOUR WORKSPACE') : mode === 'forgot' ? (zh ? '账号恢复' : 'ACCOUNT RECOVERY') : (zh ? '欢迎回来' : 'WELCOME BACK')}</span>
        <h2>{mode === 'signup' ? (zh ? '从真实工作空间开始' : 'Start with a real workspace') : mode === 'forgot' ? (zh ? '重置密码' : 'Reset your password') : (zh ? '登录 Dashloom' : 'Sign in to Dashloom')}</h2>
        <p>{mode === 'signup' ? (zh ? '产品、凭证、指标和 Agent 历史都隔离在此工作空间中。' : 'Your products, credentials, metrics, and Agent history stay isolated in this workspace.') : mode === 'forgot' ? (zh ? '请输入账号邮箱。无论该地址是否存在，返回内容都保持一致。' : 'Enter your account email. The response is identical whether or not the address exists.') : (zh ? '继续查看产品、数据源和 Agent 分析。' : 'Continue to your products, data sources, and Agent brief.')}</p>
        {mode === 'signup' && <label>{zh ? '姓名' : 'Name'}<input name="name" required minLength={2} autoComplete="name" placeholder="Alex Chen" /></label>}
        <label>{zh ? '邮箱' : 'Email'}<input name="email" required type="email" autoComplete="email" placeholder="you@company.com" /></label>
        {mode !== 'forgot' && <label>{zh ? '密码' : 'Password'}<input name="password" required type="password" minLength={10} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={zh ? '至少 10 个字符' : 'At least 10 characters'} /></label>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="button" type="submit" disabled={busy}>{busy ? (zh ? '处理中…' : 'Working…') : mode === 'signup' ? (zh ? '创建工作空间' : 'Create workspace') : mode === 'forgot' ? (zh ? '发送重置链接' : 'Send reset link') : (zh ? '登录' : 'Sign in')}</button>
        {mode === 'signin' && <button className="auth-switch" type="button" onClick={() => { setMode('forgot'); setError(''); }}>{zh ? '忘记密码？' : 'Forgot your password?'}</button>}
        <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>{mode === 'signin' ? (zh ? '第一次使用 Dashloom？创建账号' : 'New to Dashloom? Create an account') : (zh ? '返回登录' : 'Back to sign in')}</button>
      </form>
    </section>
  </main>;
}
