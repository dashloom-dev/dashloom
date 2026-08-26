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

export default async function SettingsPage() {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const [providers, entitlements, ingestionKeys, skills, views, workspaceProducts, schedules] = workspace ? await Promise.all([getDb().select().from(aiProviderAccounts).where(eq(aiProviderAccounts.workspaceId, workspace.id)), getWorkspaceEntitlements(workspace.id), getDb().select().from(ingestionApiKeys).where(eq(ingestionApiKeys.workspaceId, workspace.id)), getDb().select().from(agentSkillManifests).where(eq(agentSkillManifests.workspaceId, workspace.id)), getDb().select().from(dashboardViews).where(eq(dashboardViews.workspaceId, workspace.id)), getDb().select({ id: products.id, name: products.name }).from(products).where(eq(products.workspaceId, workspace.id)), getDb().select({ id: reportSchedules.id }).from(reportSchedules).where(eq(reportSchedules.workspaceId, workspace.id))]) : [[], null, [], [], [], [], []];
  return <div className="app-page"><header className="app-page-head"><div><span>WORKSPACE CONTROL</span><h1>Settings</h1><p>Configure workspace defaults and AI execution without putting private credentials in source control.</p></div></header>
    {workspace && ['owner', 'admin', 'member'].includes(workspace.role) && <><div className="section-label"><span>DASHBOARD TEMPLATES</span><h2>Create reusable decision views</h2></div><DashboardViewControls views={views} products={workspaceProducts} /></>}
    <section className="settings-form"><h2>Community deployment</h2><label>Edition<input value="Community" readOnly /></label><label>AI execution<input value="Bring your own OpenAI-compatible provider" readOnly /></label><label>Products<input value={entitlements ? `${workspaceProducts.length} / ${entitlements.products}` : '—'} readOnly /></label><label>Report schedules<input value={entitlements ? `${schedules.length} / ${entitlements.scheduledReports}` : '—'} readOnly /></label><label>Automatic sync floor<input value={entitlements ? `${entitlements.minimumSyncMinutes} minutes` : '—'} readOnly /></label><p>Credentials, evidence, reports, and automation stay inside this self-hosted deployment.</p></section>
    {canManage && <><div className="section-label"><span>BRING YOUR OWN MODEL</span><h2>Connect an OpenAI-compatible provider</h2></div><ProviderForm /></>}
    <section className="app-panel settings-panel"><div className="panel-title"><div><span>AI PROVIDERS</span><h2>BYOK models</h2></div><span className="status-pill">{providers.length} configured</span></div><ProviderList providers={providers.filter((provider) => provider.mode === 'byok').map((provider) => ({ id: provider.id, displayName: provider.displayName, provider: provider.provider, model: provider.model, mode: provider.mode, status: provider.status }))} canManage={canManage} /></section>
    {workspace && ['owner', 'admin'].includes(workspace.role) && <><div className="section-label"><span>EXTENSIBILITY</span><h2>Connector and Agent Skill SDK</h2></div><DeveloperControls keys={ingestionKeys} skills={skills} /></>}
  </div>;
}
