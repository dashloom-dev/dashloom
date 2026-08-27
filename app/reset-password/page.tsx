import { ResetPasswordForm } from './reset-password-form';
import { getDeploymentLocale } from '@/lib/deployment-locale';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const query = await searchParams;
  return <ResetPasswordForm token={query.token || ''} initialError={query.error || ''} locale={getDeploymentLocale()} />;
}
