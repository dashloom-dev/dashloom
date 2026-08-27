import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { agentSkillManifests, aiProviderAccounts, dashboardViews, ingestionApiKeys, products, reportSchedules } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { getWorkspaceEntitlements } from '@/lib/entitlements';
import { ProviderForm } from './provider-form';
import { DeveloperControls } from './developer-controls';
import { DashboardViewControls } from './dashboard-view-controls';
import { ProviderList } from './provider-list';
import { WorkspaceControls } from './workspace-controls';
import { DashboardTabs } from '../dashboard-tabs';

export default async function SettingsPage() {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const [providers, entitlements, ingestionKeys, skills, views, workspaceProducts, schedules] = workspace ? await Promise.all([getDb().select().from(aiProviderAccounts).where(eq(aiProviderAccounts.workspaceId, workspace.id)), getWorkspaceEntitlements(workspace.id), getDb().select().from(ingestionApiKeys).where(eq(ingestionApiKeys.workspaceId, workspace.id)), getDb().select().from(agentSkillManifests).where(eq(agentSkillManifests.workspaceId, workspace.id)), getDb().select().from(dashboardViews).where(eq(dashboardViews.workspaceId, workspace.id)), getDb().select({ id: products.id, name: products.name }).from(products).where(eq(products.workspaceId, workspace.id)), getDb().select({ id: reportSchedules.id }).from(reportSchedules).where(eq(reportSchedules.workspaceId, workspace.id))]) : [[], null, [], [], [], [], []];
  const zh = workspace?.locale === 'zh';
  const community = <div className="tab-section-stack">{workspace && <WorkspaceControls active={workspace} />}<section className="settings-form"><h2>{zh ? '社区自部署版本' : 'Community deployment'}</h2><label>{zh ? '版本' : 'Edition'}<input value="Community" readOnly /></label><label>{zh ? 'AI 执行方式' : 'AI execution'}<input value={zh ? '自带 OpenAI 兼容模型服务' : 'Bring your own OpenAI-compatible provider'} readOnly /></label><label>{zh ? '产品' : 'Products'}<input value={entitlements ? `${workspaceProducts.length} / ${entitlements.products}` : '—'} readOnly /></label><label>{zh ? '计划报告' : 'Report schedules'}<input value={entitlements ? `${schedules.length} / ${entitlements.scheduledReports}` : '—'} readOnly /></label><label>{zh ? '自动同步最短间隔' : 'Automatic sync floor'}<input value={entitlements ? `${entitlements.minimumSyncMinutes} ${zh ? '分钟' : 'minutes'}` : '—'} readOnly /></label><p>{zh ? '凭证、证据、报告和自动化数据均保留在这套自部署环境内。' : 'Credentials, evidence, reports, and automation stay inside this self-hosted deployment.'}</p></section></div>;
  const viewsPanel = <div className="tab-section-stack">{workspace && ['owner', 'admin', 'member'].includes(workspace.role) && <><div className="section-label"><span>{zh ? '看板模板' : 'DASHBOARD TEMPLATES'}</span><h2>{zh ? '创建可复用的决策视图' : 'Create reusable decision views'}</h2></div><DashboardViewControls views={views} products={workspaceProducts} /></>}</div>;
  const ai = <div className="tab-section-stack">{canManage && <><div className="section-label"><span>{zh ? '自带模型' : 'BRING YOUR OWN MODEL'}</span><h2>{zh ? '连接 OpenAI 兼容模型服务' : 'Connect an OpenAI-compatible provider'}</h2></div><ProviderForm /></>}<section className="app-panel settings-panel"><div className="panel-title"><div><span>{zh ? 'AI 服务商' : 'AI PROVIDERS'}</span><h2>{zh ? 'BYOK 模型' : 'BYOK models'}</h2></div><span className="status-pill">{providers.length} {zh ? '个配置' : 'configured'}</span></div><ProviderList providers={providers.filter((provider) => provider.mode === 'byok').map((provider) => ({ id: provider.id, displayName: provider.displayName, provider: provider.provider, model: provider.model, mode: provider.mode, status: provider.status }))} canManage={canManage} /></section></div>;
  const developer = <div className="tab-section-stack">{workspace && ['owner', 'admin'].includes(workspace.role) && <><div className="section-label"><span>{zh ? '扩展能力' : 'EXTENSIBILITY'}</span><h2>{zh ? '连接器与 Agent Skill SDK' : 'Connector and Agent Skill SDK'}</h2></div><DeveloperControls keys={ingestionKeys} skills={skills} /></>}</div>;
  return <div className="app-page"><header className="app-page-head"><div><span>{zh ? '工作空间控制' : 'WORKSPACE CONTROL'}</span><h1>{zh ? '设置' : 'Settings'}</h1><p>{zh ? '按分类管理自部署工作空间、界面、模型与开发者能力。语言保存后会立即应用到控制台。' : 'Manage your self-hosted workspace, experience, models, and developer capabilities by category.'}</p></div></header><DashboardTabs tabs={[
    { id: 'workspace', label: zh ? '工作空间' : 'Workspace', description: zh ? '基础信息、语言与部署额度' : 'Defaults, language, deployment limits', content: community },
    { id: 'views', label: zh ? '界面与视图' : 'Views', description: zh ? '可复用看板模板' : 'Reusable dashboard templates', content: viewsPanel },
    { id: 'ai', label: zh ? '模型设置' : 'AI providers', description: zh ? 'BYOK 模型连接' : 'Bring your own model', content: ai },
    { id: 'developer', label: zh ? '开发者能力' : 'Developer', description: zh ? 'API Key、连接器与 Skills' : 'Keys, connectors, and skills', content: developer },
  ]} /></div>;
}
