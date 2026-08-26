import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAuth } from '@/lib/auth';
import { discoverCloudflareWorkers } from '@/lib/cloudflare';
import { getPrimaryWorkspace } from '@/lib/workspaces';

const input = z.object({ accountId: z.string().trim().min(20).max(64), apiToken: z.string().trim().min(20).max(500) });

export async function POST(request: Request) {
  const session = await createAuth().api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(session.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin'].includes(workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid Cloudflare credentials' }, { status: 400 });
  try {
    const workers = await discoverCloudflareWorkers(parsed.data);
    return NextResponse.json({ workers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cloudflare Worker discovery failed' }, { status: 422 });
  }
}
