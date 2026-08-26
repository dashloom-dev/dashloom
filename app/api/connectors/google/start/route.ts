import { NextResponse } from 'next/server';
import { createAuth } from '@/lib/auth';
import { createGoogleAuthorization } from '@/lib/google';
import { getPrimaryWorkspace } from '@/lib/workspaces';

export async function GET(request: Request) {
  const authSession = await createAuth().api.getSession({ headers: request.headers });
  if (!authSession) return NextResponse.redirect(new URL('/login', request.url));
  const workspace = await getPrimaryWorkspace(authSession.user.id);
  if (!workspace) return NextResponse.redirect(new URL('/dashboard/sources?google=workspace-error', request.url));
  try { return NextResponse.redirect(await createGoogleAuthorization(workspace.id, authSession.user.id)); }
  catch { return NextResponse.redirect(new URL('/dashboard/sources?google=not-configured', request.url)); }
}
