import { and, asc, count, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentComparisonRuns, agentConversations, agentExecutiveBriefs, agentGrowthMissions, agentProfiles, aiProviderAccounts, analysisRuns, productGoals, products } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getDeploymentLocale } from '@/lib/deployment-locale';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { agentDefinitions, type AgentPreset } from '@/lib/agent-catalog';
import { getWorkspaceAgentReadinessSnapshot } from '@/lib/agent-readiness';
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
import { agentTaskDuration, parseAnalysisRequestQuestion } from '@/lib/agent-task-center';

const agentPresets = Object.keys(agentDefinitions) as AgentPreset[];

export default async function AgentPage({ searchParams }: { searchParams: Promise<{ preset?: string; conversation?: string }> }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const query = await searchParams;
  const [productRows, readinessSnapshot, profiles, providers, runs, conversations, comparisons, goalCount, missionCount, executiveBriefs, briefCapacity] = workspace ? await Promise.all([
    getDb().select({ id: products.id, name: products.name }).from(products).where(eq(products.workspaceId, workspace.id)).orderBy(asc(products.name)),
    getWorkspaceAgentReadinessSnapshot(workspace.id),
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

  const readiness = readinessSnapshot?.workspace || null;
  const readinessByProduct = readinessSnapshot?.byProduct || {};
  const modelReady = providers.some((item) => item.status === 'connected' && item.mode === 'byok');
  const canAnalyze = Boolean(workspace && ['owner', 'admin', 'member'].includes(workspace.role));
  const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const canCompare = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const comparisonProviders = providers.filter((provider) => provider.status === 'connected');
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const selectedConversation = conversations.find((conversation) => conversation.id === query.conversation);
  const selectedScope: AgentProductScope = selectedConversation ? { mode: selectedConversation.scopeMode, productId: selectedConversation.productId } : { mode: 'workspace', productId: null };
  const scopedReadiness = selectedScope.mode === 'product' && selectedScope.productId ? readinessByProduct[selectedScope.productId] : readiness;
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
    try { return [{ run, question: parseAnalysisRequestQuestion(run.evidenceJson), duration: agentTaskDuration(run.startedAt, run.finishedAt), result: JSON.parse(run.findingsJson!) as { summary: string; findings: Array<{ title: string; detail: string; severity: string; action: string; confidence: number; evidenceRefs: string[] }> } }]; } catch { return []; }
  });

  const zh = getDeploymentLocale() === 'zh';
  const analysis = <div className="tab-section-stack">{!modelReady && canManage && <section className="app-panel agent-provider-onboarding"><div className="panel-title"><div><span>{zh ? '生成报告前还差一步' : 'ONE STEP BEFORE YOUR FIRST REPORT'}</span><h2>{zh ? '连接一个 OpenAI 兼容模型' : 'Connect an OpenAI-compatible model'}</h2></div><span className="status-pill">BYOK · {zh ? '密钥加密保存' : 'encrypted key'}</span></div><p>{zh ? '只有点击生成报告时，Dashloom 才会把当前选择的产品数据和问题发送给你配置的模型。' : 'Dashloom sends the selected product data and your question to this model only when you create a report.'}</p><ProviderForm embedded returnTo={`/dashboard/agent?preset=${selectedPreset}`} /></section>}<section className="agent-catalog">{agentPresets.map((preset) => { const item = agentDefinitions[preset]; const status = readiness?.[preset]; return <Link href={`/dashboard/agent?preset=${preset}`} key={preset} data-active={selectedPreset === preset} data-ready={status?.ready}><span>{item.name}</span><p>{item.focus}</p><b>{status?.ready ? `${status.eligiblePointCount + status.competitorPointCount} ${zh ? '个近期数据点' : 'recent points'}` : zh ? '需要匹配的数据' : 'Needs matching data'}</b></Link>; })}</section><section className="agent-workbench">
      <aside className="agent-conversation-rail"><ConversationList conversations={conversationsWithScope} activeId={selectedConversation?.id} zh={zh} /></aside>
      <div className="agent-chat">
        <div className="agent-message"><strong>{selectedConversation ? selectedConversation.title : ready ? `${agentDefinitions[selectedPreset].name} ${zh ? '可以生成报告' : 'is ready'}` : zh ? '还不能生成报告' : 'Report setup is incomplete'}</strong><p>{ready ? selectedConversation ? (zh ? '继续提问时会使用当前选择范围内的最新数据。旧回答不会替代本次使用的数据。' : 'Follow-up questions use the latest data in the selected scope. Earlier answers do not replace the data used for this run.') : (zh ? '输入你想回答的问题。生成前，Dashloom 会保存本次使用的产品、日期、指标和数据来源。' : 'Enter the question you want answered. Before running, Dashloom saves the products, dates, metrics, and sources used for this report.') : setupMessage}</p><div className="agent-evidence"><span>{selectedScopeLabel} {zh ? '范围' : 'scope'}</span><span>{productRows.length} {zh ? '个可用产品' : 'products available'}</span><span>{selectedReadiness?.eligiblePointCount || 0} {zh ? '个指标数据点 · 14 天' : 'metric points · 14d'}</span><span>{selectedReadiness?.competitorPointCount || 0} {zh ? '个竞品数据点' : 'competitor points'}</span><span>{goalCount[0]?.value || 0} {zh ? '个产品目标' : 'product goals'}</span><span>{modelReady ? (zh ? '模型已连接' : 'Model connected') : (zh ? '需要连接模型' : 'Connect a model')}</span></div></div>
        {completed.slice(0, selectedConversation ? 10 : 3).reverse().map(({ run, result, question, duration }) => <section className="agent-turn-pair" key={run.id}>{question && <div className="agent-user-turn"><span>{zh ? '你' : 'You'}</span><p>{question}</p></div>}<article className="analysis-result"><header><span>{profileNames.get(run.agentProfileId) || (zh ? '报告' : 'REPORT')} · {run.createdAt.slice(0, 10)}</span><b>{run.inputTokens + run.outputTokens} tokens</b></header><details className="agent-process"><summary>{zh ? '分析过程' : 'Analysis process'} · {duration || (zh ? '已完成' : 'completed')}</summary><ol><li>{zh ? '冻结并保存本次证据快照' : 'Froze and stored the evidence snapshot'}</li><li>{zh ? '模型基于限定证据生成回答' : 'Model generated an answer from bounded evidence'}</li><li>{zh ? `${result.findings.length} 条发现通过结构与引用校验` : `${result.findings.length} findings passed structure and citation validation`}</li><li>{zh ? '结果已写入对话历史' : 'Result saved to conversation history'}</li></ol></details><h2>{result.summary}</h2>{result.findings.map((finding, index) => <div className="finding" key={`${run.id}-${index}`} data-severity={finding.severity}><strong>{finding.title}</strong><p>{finding.detail}</p><small>{zh ? '下一步' : 'Next'}: {finding.action} · {zh ? '置信度' : 'confidence'} {Math.round(finding.confidence * 100)}%</small><div className="finding-evidence">{finding.evidenceRefs.map((reference) => <code key={reference}>{reference}</code>)}</div></div>)}<footer className="analysis-result-actions"><Link className="analysis-audit-link" href={`/dashboard/agent/runs/${run.id}`}>{zh ? '检查冻结证据' : 'Inspect frozen evidence'} →</Link><Link className="analysis-audit-link" href="/dashboard/actions">{zh ? '转为增长任务' : 'Turn into a mission'} →</Link><AgentDashboardButton analysisRunId={run.id} /></footer></article></section>)}
        <AgentForm available={productRows.length > 0 && modelReady && canAnalyze && selectedScopeLabel !== 'Removed product'} readinessByScope={readinessByScope} lockedReady={Boolean(selectedReadiness?.ready)} defaultPreset={selectedPreset} conversationId={selectedConversation?.id} products={productRows} defaultProductId={selectedConversation?.productId} lockedScopeLabel={selectedConversation ? selectedScopeLabel : undefined} zh={zh} />
      </div>
      <aside className="agent-context"><h2>{zh ? '分析上下文' : 'Analysis context'}</h2><ul><li><span>{zh ? '产品范围' : 'Product scope'}</span><b>{selectedScopeLabel}</b></li><li><span>{zh ? '当前专家' : 'Selected specialist'}</span><b>{agentDefinitions[selectedPreset].name}</b></li><li><span>{zh ? '运行次数' : 'Thread runs'}</span><b>{runs.length}</b></li><li><span>{zh ? '近期证据' : 'Recent scoped evidence'}</span><b>{evidenceCount}</b></li><li><span>{zh ? '匹配指标' : 'Matching metrics'}</span><b>{selectedReadiness?.metricCount || 0}</b></li><li><span>{zh ? '经营目标' : 'Operating goals'}</span><b>{goalCount[0]?.value || 0}</b></li><li><span>{zh ? '进行中的任务' : 'Active missions'}</span><b>{missionCount[0]?.value || 0}</b></li><li><span>{zh ? '模型状态' : 'Model status'}</span><b>{modelReady ? (zh ? 'BYOK 已连接' : 'BYOK connected') : (zh ? '需要配置' : 'Required')}</b></li></ul></aside>
    </section></div>;
  const quality = <section className="app-panel comparison-lab"><div className="panel-title"><div><span>{zh ? 'AGENT 质量实验室' : 'AGENT QUALITY LAB'}</span><h2>{zh ? '在相同证据上比较模型' : 'Compare models on identical evidence'}</h2></div><span className="status-pill">{zh ? '提示词有版本 · 强制引用' : 'prompt versioned · citations enforced'}</span></div><p className="comparison-intro">{zh ? '比较契约合规、延迟、Token、发现类型与引用一致性。' : 'Compare contract compliance, latency, token use, finding mix, and cited-evidence agreement.'}</p><ComparisonForm providers={comparisonProviders.map((provider) => ({ id: provider.id, displayName: provider.displayName, model: provider.model, mode: provider.mode }))} readiness={readinessFlags} defaultPreset={comparisonPreset} canManage={canCompare} /><div className="comparison-history">{comparisons.map((comparison) => <Link href={`/dashboard/agent/comparisons/${comparison.id}`} key={comparison.id}><div><strong>{comparison.question}</strong><small>{comparison.agentPreset.replaceAll('_', ' ')} · prompt {comparison.promptVersion}</small></div><span>{comparison.providerCount} providers</span><b data-status={comparison.status}>{comparison.status}</b></Link>)}{!comparisons.length && <div className="panel-empty"><p>{zh ? '当前工作空间还没有运行过模型对比。' : 'No versioned model comparison has been run in this workspace.'}</p></div>}</div></section>;
  return <div className="app-page"><header className="app-page-head"><div><span>{zh ? 'AI 报告' : 'AI REPORTS'}</span><h1>{zh ? '生成报告' : 'Create a report'}</h1><p>{zh ? '选择产品和报告类型，再输入你想回答的问题。报告会保留本次使用的日期、指标和数据来源。' : 'Choose products and a report type, then enter the question you want answered. The report keeps the dates, metrics, and sources used for that run.'}</p></div><Link className="app-secondary" href="/dashboard/agent/radar">{zh ? '查看明显变化' : 'View notable changes'}</Link></header><DashboardTabs tabs={[
    { id: 'analysis', label: zh ? '分析对话' : 'Analysis', description: zh ? '选择专家、提问并检查证据' : 'Choose a specialist and inspect evidence', content: analysis },
    { id: 'briefings', label: zh ? '执行简报' : 'Briefings', description: zh ? '多专家汇总与历史简报' : 'Multi-specialist executive briefs', content: <ExecutiveBriefForm readinessByScope={readinessByScope} products={productRows} capacity={briefCapacity} briefs={executiveBriefsWithScope} canManage={canManage} /> },
    { id: 'playbook', label: zh ? '工作手册' : 'Playbook', description: zh ? '业务目标、重点与回答风格' : 'Objectives, priorities, response style', content: <AgentPlaybookForm preset={selectedPreset} playbook={selectedPlaybook} canManage={canManage} /> },
    { id: 'quality', label: zh ? '模型质量' : 'Model quality', description: zh ? '在相同证据上比较模型' : 'Compare models on identical evidence', content: quality },
  ]} /></div>;
}
