'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

export function ResetPasswordForm({ token, initialError }: { token: string; initialError: string }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(initialError ? 'This reset link is invalid or expired.' : ''); const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const password = String(new FormData(event.currentTarget).get('password') || ''); const result = await authClient.resetPassword({ newPassword: password, token }); setBusy(false); if (result.error) { setMessage(result.error.message || 'Password reset failed.'); return; } setComplete(true); setMessage('Password updated. Other sessions have been revoked.'); }
  return <main className="auth-page"><section className="auth-intro"><div><span>SECURE RECOVERY</span><h1>Back to the facts.<br />Back in control.</h1><p>Reset links are single-purpose and expire after 60 minutes. A successful reset revokes existing sessions.</p></div></section><section className="auth-panel"><form className="auth-card" onSubmit={submit}><span className="auth-kicker">DASHLOOM ACCOUNT</span><h2>Choose a new password</h2><p>Use at least 10 characters and a password you do not reuse elsewhere.</p>{!complete && token && <label>New password<input name="password" required type="password" minLength={10} maxLength={128} autoComplete="new-password" /></label>}{message && <div className={complete ? 'form-message' : 'auth-error'} role="status">{message}</div>}{!complete && <button className="button" disabled={busy || !token}>{busy ? 'Updating…' : 'Reset password'}</button>}<Link className="auth-switch" href="/login">Return to sign in</Link></form></section></main>;
}
