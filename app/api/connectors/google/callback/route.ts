import { NextResponse } from 'next/server';
import { completeGoogleAuthorization } from '@/lib/google';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (url.searchParams.get('error') || !state || !code) return NextResponse.redirect(new URL('/dashboard/sources?google=denied', request.url));
  try { const result = await completeGoogleAuthorization(state, code); return NextResponse.redirect(new URL(`/dashboard/sources?google=connected&resources=${result.resourceCount}`, request.url)); }
  catch { return NextResponse.redirect(new URL('/dashboard/sources?google=error', request.url)); }
}
