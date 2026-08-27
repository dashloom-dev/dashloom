import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDeploymentLocale } from '@/lib/deployment-locale';
import { getServerSession } from '@/lib/session';
import { LoginForm } from './login-form';

export function generateMetadata(): Metadata {
  const zh = getDeploymentLocale() === 'zh';
  return { title: zh ? '登录 — Dashloom' : 'Sign in — Dashloom', description: zh ? '登录或创建 Dashloom 工作空间。' : 'Sign in or create a Dashloom workspace.', robots: { index: false, follow: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  const next = query.next?.startsWith('/') && !query.next.startsWith('//') ? query.next : '/dashboard';
  if (await getServerSession()) redirect(next);
  return <LoginForm next={next} locale={getDeploymentLocale()} />;
}
