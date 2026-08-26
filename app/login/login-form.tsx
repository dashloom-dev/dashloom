'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

export function LoginForm({ next = '/dashboard' }: { next?: string }) {
  const router = useRouter();
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
      setBusy(false); setError(result.error?.message || 'If this email exists, a reset link has been sent.'); return;
    }
    const result = mode === 'signup' ? await authClient.signUp.email({ email, password, name }) : await authClient.signIn.email({ email, password });

    setBusy(false);
    if (result.error) {
      setError(result.error.message || 'Authentication failed. Please check your details.');
      return;
    }

    if (mode === 'signup' && !result.data?.token) {
      setMode('signin');
      setError('Account created. Check your email for the verification link before signing in.');
      return;
    }

    router.push(next);
    router.refresh();
  }

  return <main className="auth-page">
    <section className="auth-intro">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></Link>
      <div><span>AI PRODUCT INTELLIGENCE</span><h1>Connect the facts.<br />Let your Agent<br />find the signal.</h1><p>Bring Cloudflare, Google, revenue, and competitor data into one evidence layer built for operators managing multiple products.</p></div>
    </section>
    <section className="auth-panel">
      <form onSubmit={submit} className="auth-card">
        <span className="auth-kicker">{mode === 'signup' ? 'CREATE YOUR WORKSPACE' : mode === 'forgot' ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}</span>
        <h2>{mode === 'signup' ? 'Start with a real workspace' : mode === 'forgot' ? 'Reset your password' : 'Sign in to Dashloom'}</h2>
        <p>{mode === 'signup' ? 'Your products, credentials, metrics, and Agent history stay isolated in this workspace.' : mode === 'forgot' ? 'Enter your account email. The response is identical whether or not the address exists.' : 'Continue to your products, data sources, and Agent brief.'}</p>
        {mode === 'signup' && <label>Name<input name="name" required minLength={2} autoComplete="name" placeholder="Alex Chen" /></label>}
        <label>Email<input name="email" required type="email" autoComplete="email" placeholder="you@company.com" /></label>
        {mode !== 'forgot' && <label>Password<input name="password" required type="password" minLength={10} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 10 characters" /></label>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="button" type="submit" disabled={busy}>{busy ? 'Working…' : mode === 'signup' ? 'Create workspace' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}</button>
        {mode === 'signin' && <button className="auth-switch" type="button" onClick={() => { setMode('forgot'); setError(''); }}>Forgot your password?</button>}
        <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>{mode === 'signin' ? 'New to Dashloom? Create an account' : 'Back to sign in'}</button>
      </form>
    </section>
  </main>;
}
