import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const query = await searchParams;
  return <ResetPasswordForm token={query.token || ''} initialError={query.error || ''} />;
}
