import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in — Dashloom',
  description: 'Sign in or create a Dashloom workspace.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  const next = query.next?.startsWith('/') && !query.next.startsWith('//') ? query.next : '/dashboard';
  if (await getServerSession()) redirect(next);
  return <LoginForm next={next} />;
}
