import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { aiProviderAccounts } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { encryptSecret } from '@/lib/crypto';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { assertSafeRemoteUrl } from '@/lib/safe-url';
import { recordAuditEvent } from '@/lib/audit';
import { compatibilityModes, detectOpenAiCompatibility, parseProviderCompatibility } from '@/lib/openai-compatible';
import { classifyAgentFailure } from '@/lib/agent-errors';

const input = z.object({
  displayName: z.string().trim().min(2).max(80),
  baseUrl: z.string().url(),
  apiKey: z.string().trim().min(8).max(500),
  model: z.string().trim().min(1).max(120),
  compatibilityMode: z.enum(compatibilityModes).default('auto'),
});

async function current(request: Request) {
  const authSession = await createAuth().api.getSession({ headers: request.headers });
  if (!authSession) return null;
  const workspace = await getPrimaryWorkspace(authSession.user.id);
  return workspace ? { authSession, workspace } : null;
}

export async function GET(request: Request) {
  const context = await current(request);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await getDb().select({ id: aiProviderAccounts.id, displayName: aiProviderAccounts.displayName, mode: aiProviderAccounts.mode, provider: aiProviderAccounts.provider, baseUrl: aiProviderAccounts.baseUrl, model: aiProviderAccounts.model, compatibilityJson: aiProviderAccounts.compatibilityJson, status: aiProviderAccounts.status, lastCheckedAt: aiProviderAccounts.lastCheckedAt }).from(aiProviderAccounts).where(eq(aiProviderAccounts.workspaceId, context.workspace.id)).orderBy(desc(aiProviderAccounts.createdAt));
  return NextResponse.json({ providers: rows.map(({ compatibilityJson, ...provider }) => ({ ...provider, compatibilityProfile: provider.baseUrl ? parseProviderCompatibility(compatibilityJson, provider.baseUrl).profile : null })) });
}

export async function POST(request: Request) {
  const context = await current(request);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(context.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid provider' }, { status: 400 });

  const id = crypto.randomUUID();
  let baseUrl: string;
  try {
    const validatedUrl = process.env.NODE_ENV !== 'production' && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/.test(parsed.data.baseUrl) ? new URL(parsed.data.baseUrl) : await assertSafeRemoteUrl(parsed.data.baseUrl, 'Provider base URL');
    const pathname = validatedUrl.pathname.replace(/\/+$/, '');
    if (pathname.endsWith('/chat/completions')) validatedUrl.pathname = pathname.slice(0, -'/chat/completions'.length) || '/';
    baseUrl = validatedUrl.toString().replace(/\/$/, '');
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unsafe provider URL' }, { status: 400 }); }
  let status: 'connected' | 'attention' = 'attention';
  let checkMessage = 'Provider saved, but no compatible chat request passed validation.';
  let compatibilityJson = '{}';
  try {
    const compatibility = await detectOpenAiCompatibility({ baseUrl, apiKey: parsed.data.apiKey, model: parsed.data.model, mode: parsed.data.compatibilityMode });
    compatibilityJson = JSON.stringify(compatibility);
    status = 'connected'; checkMessage = `Provider connected using ${compatibility.profile}.`;
  } catch (error) { checkMessage = classifyAgentFailure(error).message; }

  await getDb().insert(aiProviderAccounts).values({
    id,
    workspaceId: context.workspace.id,
    mode: 'byok',
    provider: 'openai_compatible',
    displayName: parsed.data.displayName,
    baseUrl,
    model: parsed.data.model,
    compatibilityJson,
    encryptedApiKey: await encryptSecret(parsed.data.apiKey, `ai-provider:${context.workspace.id}:${id}`),
    status,
    lastCheckedAt: new Date().toISOString(),
  });
  return NextResponse.json({ provider: { id, displayName: parsed.data.displayName, baseUrl, model: parsed.data.model, status, compatibility: JSON.parse(compatibilityJson) }, message: checkMessage }, { status: 201 });
}

export async function DELETE(request: Request) { const context = await current(request); if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); if (!['owner', 'admin'].includes(context.workspace.role)) return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 }); const id = new URL(request.url).searchParams.get('id'); if (!id || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid provider ID is required' }, { status: 400 }); const [provider] = await getDb().select({ id: aiProviderAccounts.id, mode: aiProviderAccounts.mode }).from(aiProviderAccounts).where(and(eq(aiProviderAccounts.id, id), eq(aiProviderAccounts.workspaceId, context.workspace.id))).limit(1); if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 }); await getDb().update(aiProviderAccounts).set({ status: 'disabled', encryptedApiKey: null, updatedAt: new Date().toISOString() }).where(and(eq(aiProviderAccounts.id, id), eq(aiProviderAccounts.workspaceId, context.workspace.id))); await recordAuditEvent({ workspaceId: context.workspace.id, actorUserId: context.authSession.user.id, action: 'ai_provider.disabled', targetType: 'ai_provider', targetId: id, metadata: { mode: provider.mode, credentialRemoved: true } }); return NextResponse.json({ disabled: true }); }
