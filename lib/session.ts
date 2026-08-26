import type { Session, User } from 'better-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAuth } from './auth';

export type AuthSession = { session: Session; user: User };

export async function getServerSession(): Promise<AuthSession | null> {
  return createAuth().api.getSession({ headers: await headers() });
}

export async function requireServerSession(): Promise<AuthSession> {
  const session = await getServerSession();
  if (!session) redirect('/login');
  return session;
}
