import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAuth } from '@/lib/auth';
import { runWorkspaceAgent } from '@/lib/agent';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentConversations, products } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { getWorkspaceAgentReadiness } from '@/lib/agent-readiness';
import { agentDefinitions } from '@/lib/agent-catalog';
import { resolveAgentProductScope } from '@/lib/agent-scope';
import { classifyAgentFailure } from '@/lib/agent-errors';
import { validateAgentImageFiles } from '@/lib/agent-images';

const input = z.object({
  question: z.string().trim().min(3).max(1000),
  preset: z.enum(['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst']).default('portfolio_analyst'),
  conversationId: z.preprocess((value) => value === '' ? undefined : value, z.string().uuid().optional()),
  productId: z.preprocess((value) => value === '' ? null : value, z.string().uuid().nullable().optional()),
  stream: z.preprocess((value) => value === 'true' ? true : value === 'false' ? false : value, z.boolean().optional()),
});

export async function POST(request: Request) {
  const authSession = await createAuth().api.getSession({ headers: request.headers });
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await getPrimaryWorkspace(authSession.user.id);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  if (!['owner', 'admin', 'member'].includes(workspace.role)) return NextResponse.json({ error: 'Member access required' }, { status: 403 });
  const multipart = request.headers.get('content-type')?.includes('multipart/form-data');
  let images: Awaited<ReturnType<typeof validateAgentImageFiles>> = [];
  let requestInput: unknown;
  try {
    if (multipart) {
      const form = await request.formData();
      requestInput = { question: form.get('question'), preset: form.get('preset'), conversationId: form.get('conversationId'), productId: form.get('productId'), stream: form.get('stream') };
      images = await validateAgentImageFiles(form.getAll('images'));
    } else requestInput = await request.json().catch(() => null);
  } catch (error) {
    const failure = classifyAgentFailure(error);
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.httpStatus });
  }
  const parsed = input.safeParse(requestInput);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid question' }, { status: 400 });
  try {
    let conversationId = parsed.data.conversationId; let preset = parsed.data.preset;
    let scope = resolveAgentProductScope(parsed.data.productId);
    if (conversationId) { const [conversation] = await getDb().select().from(agentConversations).where(and(eq(agentConversations.id, conversationId), eq(agentConversations.workspaceId, workspace.id), eq(agentConversations.status, 'active'))).limit(1); if (!conversation) return NextResponse.json({ error: 'Active conversation not found in this workspace.' }, { status: 404 }); preset = conversation.agentPreset; scope = resolveAgentProductScope(parsed.data.productId, { mode: conversation.scopeMode, productId: conversation.productId }); }
    if (scope.mode === 'product') { if (!scope.productId) return NextResponse.json({ error: 'The product used by this conversation is no longer available.' }, { status: 409 }); const [product] = await getDb().select({ id: products.id }).from(products).where(and(eq(products.id, scope.productId), eq(products.workspaceId, workspace.id))).limit(1); if (!product) return NextResponse.json({ error: 'Product not found in this workspace.' }, { status: 404 }); }
    const readiness = await getWorkspaceAgentReadiness(workspace.id, scope.productId);
    if (!readiness[preset].ready && !images.length) return NextResponse.json({ error: `${agentDefinitions[preset].name} needs matching evidence from the last 14 days. Sync a relevant source, attach an image, or choose another specialist.` }, { status: 422 });
    if (!conversationId) {
      conversationId = crypto.randomUUID();
      await getDb().insert(agentConversations).values({ id: conversationId, workspaceId: workspace.id, scopeMode: scope.mode, productId: scope.productId, agentPreset: preset, title: parsed.data.question.replace(/\s+/g, ' ').slice(0, 80), createdByUserId: authSession.user.id });
      await recordAuditEvent({ workspaceId: workspace.id, actorUserId: authSession.user.id, action: 'agent_conversation.created', targetType: 'agent_conversation', targetId: conversationId, metadata: { preset, scopeMode: scope.mode, productId: scope.productId } });
    }
    if (parsed.data.stream) {
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({
        async start(controller) {
          let open = true;
          const send = (event: Record<string, unknown>) => {
            if (!open || request.signal.aborted) return;
            try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); } catch { open = false; }
          };
          try {
            send({ type: 'conversation', conversationId });
            const result = await runWorkspaceAgent(workspace.id, parsed.data.question, preset, 'chat', conversationId, scope, { abortSignal: request.signal, images, onProgress: (progress) => send({ type: 'progress', progress }) });
            send({ type: 'complete', conversationId, runId: result.runId });
          } catch (error) {
            const failure = classifyAgentFailure(error);
            send({ type: 'error', code: failure.code, error: failure.message });
          } finally {
            if (open) { try { controller.close(); } catch { /* client disconnected */ } }
          }
        },
      }), { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
    }
    return NextResponse.json({ ...(await runWorkspaceAgent(workspace.id, parsed.data.question, preset, 'chat', conversationId, scope, { images })), conversationId });
  } catch (error) {
    const failure = classifyAgentFailure(error);
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.httpStatus });
  }
}
