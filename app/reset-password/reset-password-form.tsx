'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import type { DashloomLocale } from '@/lib/deployment-locale-value';

export function ResetPasswordForm({ token, initialError, locale = 'en' }: { token: string; initialError: string; locale?: DashloomLocale }) {
  const zh = locale === 'zh';
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(initialError ? (zh ? '该重置链接无效或已过期。' : 'This reset link is invalid or expired.') : ''); const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const password = String(new FormData(event.currentTarget).get('password') || ''); const result = await authClient.resetPassword({ newPassword: password, token }); setBusy(false); if (result.error) { setMessage(result.error.message || (zh ? '密码重置失败。' : 'Password reset failed.')); return; } setComplete(true); setMessage(zh ? '密码已更新，其他会话已撤销。' : 'Password updated. Other sessions have been revoked.'); }
  return <main className="auth-page" lang={zh ? 'zh-CN' : 'en'}><section className="auth-intro"><div><span>{zh ? '安全恢复' : 'SECURE RECOVERY'}</span><h1>{zh ? <>回到事实。<br />重新掌控。</> : <>Back to the facts.<br />Back in control.</>}</h1><p>{zh ? '重置链接仅可用于本次操作，并会在 60 分钟后过期。重置成功后，其他会话将被撤销。' : 'Reset links are single-purpose and expire after 60 minutes. A successful reset revokes existing sessions.'}</p></div></section><section className="auth-panel"><form className="auth-card" onSubmit={submit}><span className="auth-kicker">{zh ? 'DASHLOOM 账号' : 'DASHLOOM ACCOUNT'}</span><h2>{zh ? '设置新密码' : 'Choose a new password'}</h2><p>{zh ? '请使用至少 10 个字符，并避免重复使用其他网站的密码。' : 'Use at least 10 characters and a password you do not reuse elsewhere.'}</p>{!complete && token && <label>{zh ? '新密码' : 'New password'}<input name="password" required type="password" minLength={10} maxLength={128} autoComplete="new-password" /></label>}{message && <div className={complete ? 'form-message' : 'auth-error'} role="status">{message}</div>}{!complete && <button className="button" disabled={busy || !token}>{busy ? (zh ? '更新中…' : 'Updating…') : (zh ? '重置密码' : 'Reset password')}</button>}<Link className="auth-switch" href="/login">{zh ? '返回登录' : 'Return to sign in'}</Link></form></section></main>;
}
