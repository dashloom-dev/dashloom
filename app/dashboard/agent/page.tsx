import { and, asc, count, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentComparisonRuns, agentConversations, agentExecutiveBriefs, agentGrowthMissions, agentProfiles, aiProviderAccounts, analysisRuns, productGoals, products } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { agentDefinitions, type AgentPreset } from '@/lib/agent-catalog';
import { getWorkspaceAgentReadiness, getWorkspaceAgentReadinessByProduct } from '@/lib/agent-readiness';
import { AgentForm } from './agent-form';
import { ConversationList } from './conversation-list';
import { ComparisonForm } from './comparison-form';
import { AgentPlaybookForm } from './agent-playbook-form';
import { defaultAgentPlaybook, parseAgentPlaybook } from '@/lib/agent-playbook';
import { AgentDashboardButton } from './agent-dashboard-button';
import { ProviderForm } from '../settings/provider-form';
import { ExecutiveBriefForm } from './executive-brief-form';
import { executiveBriefCapacity } from '@/lib/executive-brief-runner';
import { agentScopeLabel, type AgentProductScope } from '@/lib/agent-scope';

const agentPresets = Object.keys(agentDefinitions) as AgentPreset[];

export default async function AgentPage({ searchParams }: { searchParams: Promise<{ preset?: string; conversation?: string }> }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const query = await searchParams;
  const [productRows, readiness, profiles, providers, runs, conversations, comparisons, goalCount, missionCount, executiveBriefs, briefCapacity] = workspace ? await Promise.all([
    getDb().select({ id: products.id, name: products.name }).from(products).where(eq(products.workspaceId, workspace.id)).orderBy(asc(products.name)),
    getWorkspaceAgentReadiness(workspace.id),
    getDb().select().from(agentProfiles).where(eq(agentProfiles.workspaceId, workspace.id)),
    getDb().select().from(aiProviderAccounts).where(eq(aiProviderAccounts.workspaceId, workspace.id)),
    getDb().select().from(analysisRuns).where(query.conversation ? and(eq(analysisRuns.workspaceId, workspace.id), eq(analysisRuns.conversationId, query.conversation)) : eq(analysisRuns.workspaceId, workspace.id)).orderBy(desc(analysisRuns.createdAt)).limit(20),
    getDb().select().from(agentConversations).where(and(eq(agentConversations.workspaceId, workspace.id), eq(agentConversations.status, 'active'))).orderBy(desc(agentConversations.lastMessageAt)).limit(50),
    getDb().select().from(agentComparisonRuns).where(eq(agentComparisonRuns.workspaceId, workspace.id)).orderBy(desc(agentComparisonRuns.createdAt)).limit(8),
    getDb().select({ value: count() }).from(productGoals).where(and(eq(productGoals.workspaceId, workspace.id), eq(productGoals.enabled, true))),
    getDb().select({ value: count() }).from(agentGrowthMissions).where(and(eq(agentGrowthMissions.workspaceId, workspace.id), eq(agentGrowthMissions.status, 'active'))),
    getDb().select({ id: agentExecutiveBriefs.id, scopeMode: agentExecutiveBriefs.scopeMode, productId: agentExecutiveBriefs.productId, question: agentExecutiveBriefs.question, status: agentExecutiveBriefs.status, successCount: agentExecutiveBriefs.successCount, failureCount: agentExecutiveBriefs.failureCount, createdAt: agentExecutiveBriefs.createdAt }).from(agentExecutiveBriefs).where(eq(agentExecutiveBriefs.workspaceId, workspace.id)).orderBy(desc(agentExecutiveBriefs.createdAt)).limit(8),
    executiveBriefCapacity(workspace.id),
  ]) : [[], null, [], [], [], [], [], [{ value: 0 }], [{ value: 0 }], [], { mode: 'byok', capacity: 0, remaining: null, ready: false }];

  const modelReady = providers.some((item) => item.status === 'connected' && item.mode === 'byok');
  const canAnalyze = Boolean(workspace && ['owner', 'admin', 'member'].includes(workspace.role));
  const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const canCompare = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const comparisonProviders = providers.filter((provider) => provider.status === 'connected');
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const selectedConversation = conversations.find((conversation) => conversation.id === query.conversation);
  const selectedScope: AgentProductScope = selectedConversation ? { mode: selectedConversation.scopeMode, productId: selectedConversation.productId } : { mode: 'workspace', productId: null };
  const readinessByProduct = workspace ? await getWorkspaceAgentReadinessByProduct(workspace.id, productRows.map((product) => product.id)) : {};
  const scopedReadiness = selectedScope.mode === 'product' && selectedScope.productId ? readinessByProduct[selectedScope.productId] || readiness : readiness;
  const selectedScopeLabel = agentScopeLabel(selectedScope, productRows);
  const conversationsWithScope = conversations.map((conversation) => ({ ...conversation, scopeLabel: agentScopeLabel({ mode: conversation.scopeMode, productId: conversation.productId }, productRows) }));
  const selectedPreset = selectedConversation?.agentPreset || (agentPresets.includes(query.preset as AgentPreset) ? query.preset as AgentPreset : 'portfolio_analyst');
  const selectedReadiness = scopedReadiness?.[selectedPreset];
  const selectedProfile = profiles.find((profile) => profile.preset === selectedPreset);
  const selectedPlaybook = selectedProfile ? parseAgentPlaybook(selectedProfile.instructionsJson, selectedPreset) : defaultAgentPlaybook(selectedPreset);
  const readinessFlags = Object.fromEntries(agentPresets.map((preset) => [preset, Boolean(readiness?.[preset].ready)]));
  const readinessByScope = Object.fromEntries([['workspace', readinessFlags], ...productRows.map((product) => [product.id, Object.fromEntries(agentPresets.map((preset) => [preset, Boolean(readinessByProduct[product.id]?.[preset].ready)]))])]);
  const executiveBriefsWithScope = executiveBriefs.map((brief) => ({ ...brief, scopeLabel: agentScopeLabel({ mode: brief.scopeMode, productId: brief.productId }, productRows) }));
  const comparisonPreset = readinessFlags[selectedPreset] ? selectedPreset : agentPresets.find((preset) => readinessFlags[preset]) || selectedPreset;
  const ready = productRows.length > 0 && selectedScopeLabel !== 'Removed product' && Boolean(selectedReadiness?.ready) && modelReady;
  const evidenceCount = (scopedReadiness?.portfolio_analyst.eligiblePointCount || 0) + (scopedReadiness?.portfolio_analyst.competitorPointCount || 0);
  const setupMessage = !productRows.length
    ? 'Add your first product before asking the Agent.'
    : selectedScopeLabel === 'Removed product'
      ? 'The product used by this conversation has been removed. Start a new conversation with an available scope.'
    : !modelReady
      ? 'Connect a BYOK model.'
      : !selectedReadiness?.ready
        ? `${agentDefinitions[selectedPreset].name} needs matching recent evidence. Sync a relevant source or choose another specialist.`
        : 'The selected specialist has recent matching evidence and a validated model.';
  const completed = runs.filter((run) => run.status === 'success' && run.findingsJson).flatMap((run) => {
    try { return [{ run, result: JSON.parse(run.findingsJson!) as { summary: string; findings: Array<{ title: string; detail: string; severity: string; action: string; confidence: number; evidenceRefs: string[] }> } }]; } catch { return []; }
  });

  return <div className="app-page">
    <header className="app-page-head"><div><span>AI ANALYSIS</span><h1>Dashloom Agent</h1><p>Five purpose-built analysts turn server-scoped product evidence into cited explanations, ranked risks, and concrete next actions.</p></div><a className="app-secondary" href="/dashboard/agent/radar">Open Signal Radar</a></header>
    {!modelReady && canManage && <section className="app-panel agent-provider-onboarding"><div className="panel-title"><div><span>ONE STEP TO YOUR FIRST BRIEF</span><h2>Connect your own OpenAI-compatible model</h2></div><span className="status-pill">BYOK · encrypted</span></div><p>Your recent product evidence stays in this workspace until you deliberately run an analysis. Dashloom sends only the bounded evidence snapshot and your question to the provider you configure.</p><ProviderForm embedded returnTo={`/dashboard/agent?preset=${selectedPreset}`} /></section>}
    <section className="agent-catalog">{agentPresets.map((preset) => {
      const item = agentDefinitions[preset]; const status = readiness?.[preset];
      return <a href={`/dashboard/agent?preset=${preset}`} key={preset} data-active={selectedPreset === preset} data-ready={status?.ready}><span>{item.name}</span><p>{item.focus}</p><b>{status?.ready ? `${status.eligiblePointCount + status.competitorPointCount} recent points` : 'Needs matching data'}</b></a>;
    })}</section>
    <ExecutiveBriefForm readinessByScope={readinessByScope} products={productRows} capacity={briefCapacity} briefs={executiveBriefsWithScope} canManage={canManage} />
    <AgentPlaybookForm preset={selectedPreset} playbook={selectedPlaybook} canManage={canManage} />
    <section className="agent-workbench">
      <div className="agent-chat">
        <div className="agent-message"><strong>{selectedConversation ? selectedConversation.title : ready ? `${agentDefinitions[selectedPreset].name} is ready` : 'Agent setup needs attention'}</strong><p>{ready ? selectedConversation ? 'Continue this thread with fresh evidence inside its locked product scope. Historical answers provide context but never replace current citations.' : 'Ask a decision question. Dashloom freezes matching metrics, competitor signals, health, and operating-target progress before calling your model.' : setupMessage}</p><div className="agent-evidence"><span>{selectedScopeLabel} scope</span><span>{productRows.length} products available</span><span>{selectedReadiness?.eligiblePointCount || 0} matching metric points · 14d</span><span>{selectedReadiness?.competitorPointCount || 0} competitor points</span><span>{goalCount[0]?.value || 0} operating goals</span><span>{modelReady ? 'Model ready' : 'Model required'}</span></div></div>
        {completed.slice(0, selectedConversation ? 10 : 3).reverse().map(({ run, result }) => <article className="analysis-result" key={run.id}><header><span>{profileNames.get(run.agentProfileId) || 'ANALYSIS'} · {run.createdAt.slice(0, 10)}</span><b>{run.inputTokens + run.outputTokens} tokens</b></header><h2>{result.summary}</h2>{result.findings.map((finding, index) => <div className="finding" key={`${run.id}-${index}`} data-severity={finding.severity}><strong>{finding.title}</strong><p>{finding.detail}</p><small>Next: {finding.action} · confidence {Math.round(finding.confidence * 100)}%</small><div className="finding-evidence">{finding.evidenceRefs.map((reference) => <code key={reference}>{reference}</code>)}</div></div>)}<footer className="analysis-result-actions"><a className="analysis-audit-link" href={`/dashboard/agent/runs/${run.id}`}>Inspect frozen evidence →</a><a className="analysis-audit-link" href="/dashboard/actions">Turn into a mission →</a><AgentDashboardButton analysisRunId={run.id} /></footer></article>)}
        <AgentForm available={productRows.length > 0 && modelReady && canAnalyze && selectedScopeLabel !== 'Removed product'} readinessByScope={readinessByScope} lockedReady={Boolean(selectedReadiness?.ready)} defaultPreset={selectedPreset} conversationId={selectedConversation?.id} products={productRows} defaultProductId={selectedConversation?.productId} lockedScopeLabel={selectedConversation ? selectedScopeLabel : undefined} />
      </div>
      <aside className="agent-context"><ConversationList conversations={conversationsWithScope} activeId={selectedConversation?.id} /><h2>Analysis context</h2><ul><li><span>Product scope</span><b>{selectedScopeLabel}</b></li><li><span>Selected specialist</span><b>{agentDefinitions[selectedPreset].name}</b></li><li><span>Thread runs</span><b>{runs.length}</b></li><li><span>Recent scoped evidence</span><b>{evidenceCount}</b></li><li><span>Matching metrics</span><b>{selectedReadiness?.metricCount || 0}</b></li><li><span>Operating goals</span><b>{goalCount[0]?.value || 0}</b></li><li><span>Active missions</span><b>{missionCount[0]?.value || 0}</b></li><li><span>Latest match</span><b>{selectedReadiness?.latestDate || 'Required'}</b></li><li><span>Model status</span><b>{modelReady ? 'BYOK connected' : 'Required'}</b></li></ul><p className="context-note">A conversation locks its product scope on the server. Readiness uses the same scoped metric policy as the Agent. Goals and approved Growth Missions remain deterministic evidence, not predictions or causal proof.</p></aside>
    </section>
    <section className="app-panel comparison-lab"><div className="panel-title"><div><span>AGENT QUALITY LAB</span><h2>Compare models on identical evidence</h2></div><span className="status-pill">prompt versioned · citations enforced</span></div><p className="comparison-intro">Use this for provider and model selection. Dashloom reports contract compliance, latency, token use, finding mix, and cited-evidence agreement; it does not let one model grade another.</p><ComparisonForm providers={comparisonProviders.map((provider) => ({ id: provider.id, displayName: provider.displayName, model: provider.model, mode: provider.mode }))} readiness={readinessFlags} defaultPreset={comparisonPreset} canManage={canCompare} /><div className="comparison-history">{comparisons.map((comparison) => <a href={`/dashboard/agent/comparisons/${comparison.id}`} key={comparison.id}><div><strong>{comparison.question}</strong><small>{comparison.agentPreset.replaceAll('_', ' ')} · prompt {comparison.promptVersion}</small></div><span>{comparison.providerCount} providers</span><b data-status={comparison.status}>{comparison.status}</b></a>)}{!comparisons.length && <div className="panel-empty"><p>No versioned model comparison has been run in this workspace.</p></div>}</div></section>
  </div>;
}
