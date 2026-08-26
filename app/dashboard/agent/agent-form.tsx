'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentScopeReadiness, isAgentScopeReady } from '@/lib/agent-scope';

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

export function AgentForm({ available, readinessByScope, lockedReady = false, defaultPreset = 'portfolio_analyst', conversationId, products, defaultProductId = null, lockedScopeLabel }: { available: boolean; readinessByScope: AgentScopeReadiness; lockedReady?: boolean; defaultPreset?: string; conversationId?: string; products: Array<{ id: string; name: string }>; defaultProductId?: string | null; lockedScopeLabel?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [question, setQuestion] = useState('');
  const [preset, setPreset] = useState(defaultPreset);
  const [productId, setProductId] = useState(defaultProductId || '');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('Freezing evidence and running analysis…');
    const form = new FormData(event.currentTarget);
    const submittedQuestion = String(form.get('question') || '');
    const selectedPreset = String(form.get('preset') || 'portfolio_analyst');
    try {
      const response = await fetch('/api/agent/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: submittedQuestion, preset: selectedPreset, productId: productId || null, ...(conversationId ? { conversationId } : {}) }) });
      const result = await response.json() as { error?: string; conversationId?: string };
      setMessage(result.error || 'Analysis completed and stored with its evidence snapshot.');
      if (response.ok) { setQuestion(''); if (result.conversationId) router.push(`/dashboard/agent?conversation=${result.conversationId}`); router.refresh(); }
    } catch {
      setMessage('The Agent could not start. Check the connection and try again.');
    } finally {
      setPending(false);
    }
  }
  const suggestions = starterQuestions[preset] || starterQuestions.portfolio_analyst;
  const formReady = available && (conversationId ? lockedReady : isAgentScopeReady(readinessByScope, productId, preset));
  const readinessMessage = available ? 'This product scope needs matching evidence for the selected specialist.' : 'Connect evidence and a validated model to enable analysis.';
  return <form className="agent-composer" onSubmit={submit}><div className="agent-composer-scope"><label>Analysis specialist<select name="preset" value={preset} onChange={(event) => setPreset(event.target.value)} disabled={Boolean(conversationId)}>{agents.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Product scope<select name="productId" value={productId} onChange={(event) => setProductId(event.target.value)} disabled={Boolean(conversationId)}><option value="">{conversationId && !defaultProductId ? lockedScopeLabel || 'All products' : 'All products'}</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label></div>{!conversationId && <p className="agent-scope-note">Choose one real product to minimize the evidence sent to your model, or keep the portfolio-wide scope. The scope is locked when the conversation starts.</p>}{!conversationId && <div className="agent-starters" aria-label="Suggested analysis questions">{suggestions.map((item) => <button type="button" key={item} disabled={!formReady || pending} onClick={() => setQuestion(item)}>{item}</button>)}</div>}<textarea name="question" required minLength={3} maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)} disabled={!formReady || pending} placeholder={conversationId ? 'Ask a follow-up using the latest evidence…' : 'Ask what changed, why it matters, and what to do next…'} /><footer><small>{message || (formReady ? conversationId ? 'This follow-up keeps the locked product scope, bounded history, and fresh evidence.' : 'A new auditable conversation will be created with this evidence scope.' : readinessMessage)}</small><button className="app-primary" disabled={!formReady || pending}>{pending ? 'Analyzing…' : conversationId ? 'Ask follow-up' : 'Start analysis'}</button></footer></form>;
}
