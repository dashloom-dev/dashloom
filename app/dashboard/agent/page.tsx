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
import Link from 'next/link';
import { DashboardTabs } from '../dashboard-tabs';

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

  const zh = workspace?.locale === 'zh';
  const analysis = <div className="tab-section-stack">{!modelReady && canManage && <section className="app-panel agent-provider-onboarding"><div className="panel-title"><div><span>{zh ? '距离第一份简报只差一步' : 'ONE STEP TO YOUR FIRST BRIEF'}</span><h2>{zh ? '连接你的 OpenAI 兼容模型' : 'Connect your own OpenAI-compatible model'}</h2></div><span className="status-pill">BYOK · {zh ? '已加密' : 'encrypted'}</span></div><p>{zh ? '只有在你主动运行分析时，Dashloom 才会向所配置的模型服务发送有界证据快照和问题。' : 'Your recent product evidence stays in this workspace until you deliberately run an analysis.'}</p><ProviderForm embedded returnTo={`/dashboard/agent?preset=${selectedPreset}`} /></section>}<section className="agent-catalog">{agentPresets.map((preset) => { const item = agentDefinitions[preset]; const status = readiness?.[preset]; return <Link href={`/dashboard/agent?preset=${preset}`} key={preset} data-active={selectedPreset === preset} data-ready={status?.ready}><span>{item.name}</span><p>{item.focus}</p><b>{status?.ready ? `${status.eligiblePointCount + status.competitorPointCount} ${zh ? '个近期数据点' : 'recent points'}` : zh ? '需要匹配的数据' : 'Needs matching data'}</b></Link>; })}</section><section className="agent-workbench">
      <div className="agent-chat">
        <div className="agent-message"><strong>{selectedConversation ? selectedConversation.title : ready ? `${agentDefinitions[selectedPreset].name} ${zh ? '已准备好' : 'is ready'}` : zh ? 'Agent 设置需要处理' : 'Agent setup needs attention'}</strong><p>{ready ? (zh ? '提出一个决策问题。调用模型前，Dashloom 会冻结匹配证据。' : 'Ask a decision question. Dashloom freezes matching evidence before calling your model.') : setupMessage}</p><div className="agent-evidence"><span>{selectedScopeLabel} {zh ? '范围' : 'scope'}</span><span>{productRows.length} {zh ? '个可用产品' : 'products available'}</span><span>{selectedReadiness?.eligiblePointCount || 0} {zh ? '个匹配指标点 · 14 天' : 'matching metric points · 14d'}</span><span>{selectedReadiness?.competitorPointCount || 0} {zh ? '个竞品数据点' : 'competitor points'}</span><span>{goalCount[0]?.value || 0} {zh ? '个经营目标' : 'operating goals'}</span><span>{modelReady ? (zh ? '模型已就绪' : 'Model ready') : (zh ? '需要模型' : 'Model required')}</span></div></div>
        {completed.slice(0, selectedConversation ? 10 : 3).reverse().map(({ run, result }) => <article className="analysis-result" key={run.id}><header><span>{profileNames.get(run.agentProfileId) || 'ANALYSIS'} · {run.createdAt.slice(0, 10)}</span><b>{run.inputTokens + run.outputTokens} tokens</b></header><h2>{result.summary}</h2>{result.findings.map((finding, index) => <div className="finding" key={`${run.id}-${index}`} data-severity={finding.severity}><strong>{finding.title}</strong><p>{finding.detail}</p><small>{zh ? '下一步' : 'Next'}: {finding.action} · {zh ? '置信度' : 'confidence'} {Math.round(finding.confidence * 100)}%</small><div className="finding-evidence">{finding.evidenceRefs.map((reference) => <code key={reference}>{reference}</code>)}</div></div>)}<footer className="analysis-result-actions"><Link className="analysis-audit-link" href={`/dashboard/agent/runs/${run.id}`}>{zh ? '检查冻结证据' : 'Inspect frozen evidence'} →</Link><Link className="analysis-audit-link" href="/dashboard/actions">{zh ? '转为增长任务' : 'Turn into a mission'} →</Link><AgentDashboardButton analysisRunId={run.id} /></footer></article>)}
        <AgentForm available={productRows.length > 0 && modelReady && canAnalyze && selectedScopeLabel !== 'Removed product'} readinessByScope={readinessByScope} lockedReady={Boolean(selectedReadiness?.ready)} defaultPreset={selectedPreset} conversationId={selectedConversation?.id} products={productRows} defaultProductId={selectedConversation?.productId} lockedScopeLabel={selectedConversation ? selectedScopeLabel : undefined} />
      </div>
      <aside className="agent-context"><ConversationList conversations={conversationsWithScope} activeId={selectedConversation?.id} /><h2>{zh ? '分析上下文' : 'Analysis context'}</h2><ul><li><span>{zh ? '产品范围' : 'Product scope'}</span><b>{selectedScopeLabel}</b></li><li><span>{zh ? '当前专家' : 'Selected specialist'}</span><b>{agentDefinitions[selectedPreset].name}</b></li><li><span>{zh ? '运行次数' : 'Thread runs'}</span><b>{runs.length}</b></li><li><span>{zh ? '近期证据' : 'Recent scoped evidence'}</span><b>{evidenceCount}</b></li><li><span>{zh ? '匹配指标' : 'Matching metrics'}</span><b>{selectedReadiness?.metricCount || 0}</b></li><li><span>{zh ? '经营目标' : 'Operating goals'}</span><b>{goalCount[0]?.value || 0}</b></li><li><span>{zh ? '进行中的任务' : 'Active missions'}</span><b>{missionCount[0]?.value || 0}</b></li><li><span>{zh ? '模型状态' : 'Model status'}</span><b>{modelReady ? (zh ? 'BYOK 已连接' : 'BYOK connected') : (zh ? '需要配置' : 'Required')}</b></li></ul></aside>
    </section></div>;
  const quality = <section className="app-panel comparison-lab"><div className="panel-title"><div><span>{zh ? 'AGENT 质量实验室' : 'AGENT QUALITY LAB'}</span><h2>{zh ? '在相同证据上比较模型' : 'Compare models on identical evidence'}</h2></div><span className="status-pill">{zh ? '提示词有版本 · 强制引用' : 'prompt versioned · citations enforced'}</span></div><p className="comparison-intro">{zh ? '比较契约合规、延迟、Token、发现类型与引用一致性。' : 'Compare contract compliance, latency, token use, finding mix, and cited-evidence agreement.'}</p><ComparisonForm providers={comparisonProviders.map((provider) => ({ id: provider.id, displayName: provider.displayName, model: provider.model, mode: provider.mode }))} readiness={readinessFlags} defaultPreset={comparisonPreset} canManage={canCompare} /><div className="comparison-history">{comparisons.map((comparison) => <Link href={`/dashboard/agent/comparisons/${comparison.id}`} key={comparison.id}><div><strong>{comparison.question}</strong><small>{comparison.agentPreset.replaceAll('_', ' ')} · prompt {comparison.promptVersion}</small></div><span>{comparison.providerCount} providers</span><b data-status={comparison.status}>{comparison.status}</b></Link>)}{!comparisons.length && <div className="panel-empty"><p>{zh ? '当前工作空间还没有运行过模型对比。' : 'No versioned model comparison has been run in this workspace.'}</p></div>}</div></section>;
  return <div className="app-page"><header className="app-page-head"><div><span>{zh ? 'AI 分析' : 'AI ANALYSIS'}</span><h1>Dashloom Agent</h1><p>{zh ? '五类专用分析师把产品证据转成带引用的解释、风险排序与具体行动。' : 'Five purpose-built analysts turn product evidence into cited explanations, ranked risks, and concrete next actions.'}</p></div><Link className="app-secondary" href="/dashboard/agent/radar">{zh ? '打开信号雷达' : 'Open Signal Radar'}</Link></header><DashboardTabs tabs={[
    { id: 'analysis', label: zh ? '分析对话' : 'Analysis', description: zh ? '选择专家、提问并检查证据' : 'Choose a specialist and inspect evidence', content: analysis },
    { id: 'briefings', label: zh ? '执行简报' : 'Briefings', description: zh ? '多专家汇总与历史简报' : 'Multi-specialist executive briefs', content: <ExecutiveBriefForm readinessByScope={readinessByScope} products={productRows} capacity={briefCapacity} briefs={executiveBriefsWithScope} canManage={canManage} /> },
    { id: 'playbook', label: zh ? '工作手册' : 'Playbook', description: zh ? '业务目标、重点与回答风格' : 'Objectives, priorities, response style', content: <AgentPlaybookForm preset={selectedPreset} playbook={selectedPlaybook} canManage={canManage} /> },
    { id: 'quality', label: zh ? '模型质量' : 'Model quality', description: zh ? '在相同证据上比较模型' : 'Compare models on identical evidence', content: quality },
  ]} /></div>;
}
