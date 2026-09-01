import { eq } from 'drizzle-orm';
import { Cable, ShieldCheck, Sparkles } from 'lucide-react';
import { getDb } from '@/db';
import { agentSkillManifests } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { getMarketplaceInstallState, marketplaceConnectors, marketplaceSkills } from '@/lib/extension-marketplace';
import { MarketplaceSkills, type MarketplaceSkillCard } from './marketplace-client';

export default async function MarketplacePage() {
  const { user } = await requireServerSession(); const workspace = await getPrimaryWorkspace(user.id);
  if (!workspace) return <div className="empty-state"><h1>Workspace setup needs attention</h1></div>;
  const installed = await getDb().select().from(agentSkillManifests).where(eq(agentSkillManifests.workspaceId, workspace.id));
  const installedBySlug = new Map(installed.map((skill) => [skill.slug, skill]));
  const skills: MarketplaceSkillCard[] = marketplaceSkills.map((item) => { const current = installedBySlug.get(item.slug); return { slug: item.slug, name: item.manifest.name, summary: item.summary, publisher: item.publisher, version: item.manifest.version, basePreset: item.manifest.basePreset, requiredMetrics: item.manifest.requiredMetrics, sourceUrl: item.sourceUrl, reviewedAt: item.review.reviewedAt, installState: getMarketplaceInstallState(item.manifest, current) }; });
  const canManage = ['owner', 'admin'].includes(workspace.role);

  return <div className="app-page marketplace-page">
    <header className="app-page-head"><div><span>AI EXTENSIONS</span><h1>Add more report types.</h1><p>Install an AI extension for a specific kind of report, or connect another data source.</p></div><a className="app-secondary" href="https://github.com/dashloom-dev/dashloom/blob/main/docs/agent-skill-sdk.md" target="_blank" rel="noreferrer">Build an extension ↗</a></header>
    <div className="marketplace-trust"><ShieldCheck size={24} /><div><strong>Review the source before installing</strong><p>Extensions marked “Maintainer reviewed” were checked against Dashloom’s publishing rules, but this is not an independent security audit.</p></div></div>
    <div className="section-label"><span><Sparkles size={15} /> REPORT EXTENSIONS</span><h2>Install another type of AI report</h2></div>
    <MarketplaceSkills skills={skills} canManage={canManage} />
    <div className="section-label"><span><Cable size={15} /> DATA SOURCES</span><h2>Connections already included with Dashloom</h2></div>
    <div className="marketplace-grid connector-marketplace">{marketplaceConnectors.map((connector) => <article className="marketplace-card" key={connector.slug}><header><div><span>BUILT-IN DATA SOURCE</span><h2>{connector.name}</h2></div><b>included</b></header><p>{connector.summary}</p><div className="marketplace-signals">{connector.signals.map((signal) => <code key={signal}>{signal}</code>)}</div><footer><span><strong>{connector.publisher}</strong><small>Credentials stay on the server · limited to this workspace</small></span><a className="app-primary" href={connector.href}>Set up</a></footer></article>)}</div>
  </div>;
}
