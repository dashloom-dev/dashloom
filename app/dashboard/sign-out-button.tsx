'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function SignOutButton() {
  const router = useRouter();
  return <button className="app-signout" onClick={async () => { await authClient.signOut(); router.push('/login'); router.refresh(); }}><LogOut size={18} /> Sign out</button>;
}
