'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentScopeReadiness, isAgentScopeReady } from '@/lib/agent-scope';
import { translateDashboard } from '../dashboard-translations';

type Progress = { stage: string; label: string; detail: string };

const zhProgress: Record<string, { label: string; detail: string }> = {
  preparing: { label: '准备分析', detail: '正在检查所选专家、产品范围和模型配置。' },
  evidence_frozen: { label: '证据已冻结', detail: '本次使用的数据已经锁定并保存到证据快照。' },
  model_running: { label: 'Agent 正在分析', detail: '模型正在比较限定证据并生成带引用的发现。' },
  output_validated: { label: '输出已校验', detail: '结构化结果和证据引用已通过校验。' },
  completed: { label: '已保存到历史', detail: '本次回答、用量和证据快照均已保存。' },
};

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
  const [progress, setProgress] = useState<Progress[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const guardLinks = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest('a[href]');
      if (link && !window.confirm(zh ? '离开当前页面会中断本次交流。确定离开吗？' : 'Leaving this page will interrupt this conversation. Leave anyway?')) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardLinks, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guardLinks, true); };
  }, [pending, zh]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(zh ? '正在准备分析…' : 'Preparing analysis…');
    const form = new FormData(event.currentTarget);
    const submittedQuestion = String(form.get('question') || '');
    const selectedPreset = String(form.get('preset') || 'portfolio_analyst');
    const startsNewConversation = Boolean(conversationId) && (selectedPreset !== defaultPreset || productId !== (defaultProductId || ''));
    setSubmittedQuestion(submittedQuestion);
    setProgress([]);
    const controller = new AbortController();
    abortRef.current = controller;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const response = await fetch('/api/agent/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ question: submittedQuestion, preset: selectedPreset, productId: productId || null, stream: true, ...(conversationId && !startsNewConversation ? { conversationId } : {}) }) });
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
          const streamEvent = JSON.parse(line) as { type: string; progress?: Progress; error?: string; conversationId?: string };
          if (streamEvent.type === 'progress' && streamEvent.progress) {
            const localized = zh && zhProgress[streamEvent.progress.stage] ? { ...streamEvent.progress, ...zhProgress[streamEvent.progress.stage] } : streamEvent.progress;
            setProgress((current) => [...current, localized]);
          }
          if (streamEvent.conversationId) nextConversationId = streamEvent.conversationId;
          if (streamEvent.type === 'error') throw new Error(streamEvent.error || 'Analysis failed');
        }
        if (done) break;
      }
      setMessage(zh ? '分析已完成，并连同证据快照保存。' : 'Analysis completed and stored with its evidence snapshot.');
      setQuestion('');
      if (nextConversationId) router.push(`/dashboard/agent?conversation=${nextConversationId}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError' ? (zh ? '本次分析已停止。' : 'Analysis stopped.') : displayError(error, zh));
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
  const formReady = available && (conversationId && !startsNewConversation ? lockedReady : isAgentScopeReady(readinessByScope, productId, preset));
  const readinessMessage = available ? (zh ? '当前产品范围缺少所选专家需要的匹配数据。' : 'This product scope needs matching evidence for the selected specialist.') : (zh ? '连接数据并验证模型后即可开始分析。' : 'Connect evidence and a validated model to enable analysis.');
  return <form className="agent-composer" onSubmit={submit}>{pending && <section className="agent-live-turn"><p>{submittedQuestion}</p><details open><summary>{zh ? '分析过程' : 'Analysis process'}</summary>{progress.length ? progress.map((item) => <div key={item.stage}><b>{item.label}</b><span>{item.detail}</span></div>) : <div><b>{zh ? '正在准备' : 'Preparing'}</b><span>{zh ? '正在检查范围、证据和模型配置。' : 'Checking scope, evidence, and model configuration.'}</span></div>}</details></section>}<div className="agent-composer-scope"><label>{zh ? '分析专家' : 'Analysis specialist'}<select name="preset" value={preset} onChange={(event) => setPreset(event.target.value)} disabled={pending}>{agents.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>{zh ? '产品范围' : 'Product scope'}<select name="productId" value={productId} onChange={(event) => setProductId(event.target.value)} disabled={pending}><option value="">{conversationId && !defaultProductId ? lockedScopeLabel || (zh ? '全部产品' : 'All products') : (zh ? '全部产品' : 'All products')}</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label></div>{conversationId && startsNewConversation ? <p className="agent-scope-note">{zh ? '更改范围后将创建新对话，当前历史保持不变。' : 'Changing scope creates a new conversation and keeps this history unchanged.'}</p> : !conversationId ? <p className="agent-scope-note">{zh ? '选择范围后直接提问；开始对话后更改范围会创建新对话。' : 'Choose a scope and ask directly. Changing scope later creates a new conversation.'}</p> : null}{!conversationId && <div className="agent-starters" aria-label={zh ? '建议问题' : 'Suggested analysis questions'}>{suggestions.map((item) => <button type="button" key={item} disabled={!formReady || pending} onClick={() => setQuestion(item)}>{item}</button>)}</div>}{pending && <div className="agent-leave-warning">{zh ? '离开当前页面会中断本次交流' : 'Leaving this page will interrupt this conversation'}</div>}<textarea name="question" required minLength={3} maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={onQuestionKeyDown} disabled={!formReady || pending} placeholder={conversationId && !startsNewConversation ? (zh ? '继续追问，Enter 发送，Shift + Enter 换行…' : 'Ask a follow-up. Enter to send, Shift + Enter for a new line…') : (zh ? '询问发生了什么、为什么重要、下一步怎么做…' : 'Ask what changed, why it matters, and what to do next…')} /><footer><small>{message || (formReady ? conversationId && !startsNewConversation ? (zh ? '沿用当前范围，并使用最新证据。' : 'Uses the current scope and latest evidence.') : (zh ? '将保存本次证据快照，方便后续审计。' : 'Saves an evidence snapshot for later review.') : readinessMessage)}</small>{pending ? <button type="button" className="app-secondary" onClick={() => abortRef.current?.abort()}>{zh ? '停止' : 'Stop'}</button> : <button className="app-primary" disabled={!formReady}>{conversationId && !startsNewConversation ? (zh ? '发送' : 'Send') : (zh ? '开始新对话' : 'Start new conversation')}</button>}</footer></form>;
}
