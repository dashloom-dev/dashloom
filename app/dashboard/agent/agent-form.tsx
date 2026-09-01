'use client';

import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AgentScopeReadiness, isAgentScopeReady } from '@/lib/agent-scope';
import { translateDashboard } from '../dashboard-translations';
import { agentBeforeNewConversationEvent } from './agent-conversation-pane';
import { AgentRunTrace, type AgentExecutionTraceStep } from './agent-run-transparency';
import { AGENT_IMAGE_ACCEPT, AGENT_IMAGE_MAX_BYTES, AGENT_IMAGE_MAX_COUNT, AGENT_IMAGE_MAX_TOTAL_BYTES } from '@/lib/agent-images';

type Progress = AgentExecutionTraceStep;
type ImageAttachment = { id: string; file: File; previewUrl: string };
const imageSizeUnit = 'KB';

function displayError(error: unknown, zh: boolean) {
  const message = error instanceof Error ? error.message : 'Analysis failed';
  if (!zh) return message;
  const translated = translateDashboard(message);
  return translated !== message || /[\u3400-\u9fff]/.test(message) ? translated : 'Agent 分析失败，请检查模型连接、模型配置和数据后重试。';
}

const agents = [
  ['portfolio_analyst', 'Portfolio Analyst'],
  ['revenue_analyst', 'Revenue Analyst'],
  ['seo_growth_analyst', 'SEO Growth Analyst'],
  ['operations_analyst', 'Operations Analyst'],
  ['client_reporting_analyst', 'Client Reporting Analyst'],
] as const;

const starterQuestions: Record<string, string[]> = {
  portfolio_analyst: ['Which product is furthest from its operating goal?', 'What changed across my portfolio this week?', 'Where should I invest the next day of work?'],
  revenue_analyst: ['Which revenue goal is at risk, and why?', 'Which retention or refund risk needs action?', 'What commercial experiment should I run next?'],
  seo_growth_analyst: ['Which SEO goal is furthest off track?', 'Where is visibility not turning into clicks?', 'How do our search trends compare with competitors?'],
  operations_analyst: ['What operational regression should I investigate first?', 'Which product has the weakest health evidence?', 'What changed after recent deployments?'],
  client_reporting_analyst: ['Prepare a client-safe win, risk, and next action.', 'What should the client understand this week?', 'Turn the latest evidence into an executive update.'],
};

export function AgentForm({ available, readinessByScope, lockedReady = false, defaultPreset = 'portfolio_analyst', conversationId, products, defaultProductId = null, lockedScopeLabel, zh = false }: { available: boolean; readinessByScope: AgentScopeReadiness; lockedReady?: boolean; defaultPreset?: string; conversationId?: string; products: Array<{ id: string; name: string }>; defaultProductId?: string | null; lockedScopeLabel?: string; zh?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [question, setQuestion] = useState('');
  const [preset, setPreset] = useState(defaultPreset);
  const [productId, setProductId] = useState(defaultProductId || '');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [submittedImageCount, setSubmittedImageCount] = useState(0);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<ImageAttachment[]>([]);
  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  useEffect(() => () => attachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl)), []);
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const guardLinks = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest('a[href]');
      if (link && !window.confirm(zh ? '离开当前页面会中断本次交流。确定离开吗？' : 'Leaving this page will interrupt this conversation. Leave anyway?')) event.preventDefault();
    };
    const guardNewConversation = (event: Event) => {
      if (!window.confirm(zh ? '新建对话会中断本次交流。确定新建吗？' : 'Starting a new conversation will interrupt this one. Continue?')) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener(agentBeforeNewConversationEvent, guardNewConversation);
    document.addEventListener('click', guardLinks, true);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener(agentBeforeNewConversationEvent, guardNewConversation); document.removeEventListener('click', guardLinks, true); };
  }, [pending, zh]);
  function addImages(files: File[]) {
    const accepted = files.filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type));
    if (accepted.length !== files.length) { setMessage(zh ? '仅支持 PNG、JPEG 和 WebP 图片。' : 'Only PNG, JPEG, and WebP images are supported.'); return; }
    if (accepted.some((file) => file.size > AGENT_IMAGE_MAX_BYTES)) { setMessage(zh ? '每张图片不能超过 5 MB。' : 'Each image must be 5 MB or smaller.'); return; }
    if (attachments.length + accepted.length > AGENT_IMAGE_MAX_COUNT) { setMessage(zh ? `每条消息最多添加 ${AGENT_IMAGE_MAX_COUNT} 张图片。` : `Attach up to ${AGENT_IMAGE_MAX_COUNT} images per message.`); return; }
    if ([...attachments.map((item) => item.file), ...accepted].reduce((total, file) => total + file.size, 0) > AGENT_IMAGE_MAX_TOTAL_BYTES) { setMessage(zh ? '图片总大小不能超过 12 MB。' : 'Attached images must be 12 MB or smaller in total.'); return; }
    setAttachments((current) => [...current, ...accepted.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }))]);
    setMessage('');
  }
  function removeImage(id: string) {
    setAttachments((current) => current.filter((attachment) => { if (attachment.id === id) URL.revokeObjectURL(attachment.previewUrl); return attachment.id !== id; }));
  }
  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const images = [...event.clipboardData.files].filter((file) => file.type.startsWith('image/'));
    if (images.length) { event.preventDefault(); addImages(images); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(zh ? '正在准备分析…' : 'Preparing analysis…');
    const form = new FormData(event.currentTarget);
    const submittedQuestion = String(form.get('question') || '');
    const selectedPreset = String(form.get('preset') || 'portfolio_analyst');
    const startsNewConversation = Boolean(conversationId) && (selectedPreset !== defaultPreset || productId !== (defaultProductId || ''));
    setSubmittedQuestion(submittedQuestion);
    setSubmittedImageCount(attachments.length);
    setProgress([]);
    const controller = new AbortController();
    abortRef.current = controller;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const requestBody = new FormData();
      requestBody.set('question', submittedQuestion);
      requestBody.set('preset', selectedPreset);
      requestBody.set('productId', productId);
      requestBody.set('stream', 'true');
      if (conversationId && !startsNewConversation) requestBody.set('conversationId', conversationId);
      attachments.forEach((attachment) => requestBody.append('images', attachment.file));
      const response = await fetch('/api/agent/analyze', { method: 'POST', signal: controller.signal, body: requestBody });
      if (!response.ok || !response.body) throw new Error((await response.json() as { error?: string }).error || 'Analysis failed');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let nextConversationId = startsNewConversation ? undefined : conversationId;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; progress?: Progress; error?: string; conversationId?: string };
          if (event.type === 'progress' && event.progress) {
            setProgress((current) => {
              const index = current.findIndex((item) => item.stage === event.progress!.stage);
              if (index < 0) return [...current, event.progress!];
              return current.map((item, itemIndex) => itemIndex === index ? event.progress! : item);
            });
          }
          if (event.conversationId) nextConversationId = event.conversationId;
          if (event.type === 'error') throw new Error(event.error || 'Analysis failed');
        }
        if (done) break;
      }
      setMessage(zh ? '分析已完成，并连同证据快照保存。' : 'Analysis completed and stored with its evidence snapshot.');
      setQuestion('');
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
      setAttachments([]);
      if (nextConversationId && nextConversationId !== conversationId) {
        router.push(`/dashboard/agent?conversation=${nextConversationId}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      const failureMessage = error instanceof DOMException && error.name === 'AbortError' ? (zh ? '本次分析已停止。' : 'Analysis stopped.') : displayError(error, zh);
      setMessage(failureMessage);
      setProgress((current) => {
        const activeIndex = current.findLastIndex((item) => item.status === 'in_progress');
        if (activeIndex < 0) return current;
        return current.map((item, index) => index === activeIndex ? { ...item, status: 'failed', detail: failureMessage, completedAt: new Date().toISOString() } : item);
      });
    } finally {
      abortRef.current = null;
      setPending(false);
    }
  }
  function onQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
  }
  const suggestions = starterQuestions[preset] || starterQuestions.portfolio_analyst;
  const startsNewConversation = Boolean(conversationId) && (preset !== defaultPreset || productId !== (defaultProductId || ''));
  const evidenceReady = conversationId && !startsNewConversation ? lockedReady : isAgentScopeReady(readinessByScope, productId, preset);
  const formReady = available && (evidenceReady || attachments.length > 0);
  const readinessMessage = available ? 'This product scope needs matching evidence for the selected specialist.' : 'Connect evidence and a validated model to enable analysis.';
  return <form className="agent-composer" onSubmit={submit}>
    {(pending || progress.some((item) => item.status === 'failed')) && <section className="agent-live-turn"><p>{submittedQuestion}{submittedImageCount ? <small>{zh ? ` · ${submittedImageCount} 张图片` : ` · ${submittedImageCount} image${submittedImageCount === 1 ? '' : 's'}`}</small> : null}</p><AgentRunTrace trace={progress} zh={zh} live /></section>}
    <div className="agent-composer-toolbar">
      <div className="agent-composer-scope">
        <label>{zh ? '分析专家' : 'Analysis specialist'}<select name="preset" value={preset} onChange={(event) => setPreset(event.target.value)} disabled={pending}>{agents.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>{zh ? '产品范围' : 'Product scope'}<select name="productId" value={productId} onChange={(event) => setProductId(event.target.value)} disabled={pending}><option value="">{conversationId && !defaultProductId ? lockedScopeLabel || (zh ? '全部产品' : 'All products') : (zh ? '全部产品' : 'All products')}</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
      </div>
      {conversationId && startsNewConversation ? <p className="agent-scope-note">{zh ? '更改范围后将创建新对话，当前历史保持不变。' : 'Changing scope creates a new conversation and keeps this history unchanged.'}</p> : !conversationId ? <p className="agent-scope-note">{zh ? '选择范围后直接提问；开始对话后更改范围会创建新对话。' : 'Choose a scope and ask directly. Changing scope later creates a new conversation.'}</p> : null}
    </div>
    {!conversationId && <div className="agent-starters" aria-label={zh ? '建议问题' : 'Suggested analysis questions'}>{suggestions.map((item) => <button type="button" key={item} disabled={!formReady || pending} onClick={() => setQuestion(item)}>{item}</button>)}</div>}
    <div className="agent-prompt-box">
      <div className="agent-leave-warning">{zh ? '离开页面会中断当前交流' : 'Leaving this page interrupts the current conversation'}</div>
      {attachments.length ? <div className="agent-image-previews">{attachments.map((attachment) => <figure key={attachment.id}><Image src={attachment.previewUrl} alt={zh ? '待分析图片预览' : 'Image to analyze'} width={76} height={58} unoptimized /><button type="button" onClick={() => removeImage(attachment.id)} disabled={pending} aria-label={zh ? '移除图片' : 'Remove image'}>×</button><figcaption>{Math.max(1, Math.ceil(attachment.file.size / 1024))} {imageSizeUnit}</figcaption></figure>)}</div> : null}
      <textarea name="question" required minLength={3} maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={onQuestionKeyDown} onPaste={onPaste} disabled={!available || pending} placeholder={conversationId && !startsNewConversation ? (zh ? '继续追问；Enter 发送，Shift + Enter 换行，也可粘贴截图…' : 'Ask a follow-up. Enter to send, Shift + Enter for a new line, or paste a screenshot…') : (zh ? '询问问题，或粘贴截图让 Agent 分析…' : 'Ask a question, or paste a screenshot for the Agent to analyze…')} />
      <footer><div className="agent-attachment-control"><input ref={fileInputRef} type="file" accept={AGENT_IMAGE_ACCEPT} multiple hidden onChange={(event) => { addImages([...event.target.files || []]); event.target.value = ''; }} /><button type="button" className="agent-attach-button" disabled={!available || pending || attachments.length >= AGENT_IMAGE_MAX_COUNT} onClick={() => fileInputRef.current?.click()}>{zh ? '＋ 添加图片' : '＋ Add images'}</button><small>{attachments.length}/{AGENT_IMAGE_MAX_COUNT}</small></div><small>{message || (formReady ? attachments.length ? (zh ? '原图仅随本次请求发送；历史记录只保存哈希和证据 ID。' : 'Original images are sent only for this request; history stores only hashes and evidence IDs.') : conversationId && !startsNewConversation ? (zh ? '沿用当前范围，并使用最新证据。' : 'Uses the current scope and latest evidence.') : (zh ? '将保存本次证据快照，方便后续审计。' : 'Saves an evidence snapshot for later review.') : readinessMessage)}</small>{pending ? <button type="button" className="app-secondary" onClick={() => abortRef.current?.abort()}>{zh ? '停止' : 'Stop'}</button> : <button className="app-primary" disabled={!formReady}>{conversationId && !startsNewConversation ? (zh ? '发送' : 'Send') : (zh ? '开始新对话' : 'Start new conversation')}</button>}</footer>
    </div>
  </form>;
}
