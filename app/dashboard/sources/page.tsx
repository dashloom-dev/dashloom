import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { calculatedMetricDefinitions, connectorAccounts, connectorResources, competitors, productConnectorMappings, products, syncRuns, syncSchedules } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { MetricImportForm } from './metric-import-form';
import { CloudflareForm } from './cloudflare-form';
import { GoogleControls } from './google-controls';
import { BingControls } from './bing-controls';
import { D1Form } from './d1-form';
import { CompetitorForm } from './competitor-form';
import { SyncScheduleForm } from './sync-schedule-form';
import { getWorkspaceEntitlements } from '@/lib/entitlements';
import { StripeForm } from './stripe-form';
import { LemonSqueezyForm } from './lemon-squeezy-form';
import { CalculatedMetricForm } from './calculated-metric-form';
import { GitHubForm } from './github-form';
import { VercelForm } from './vercel-form';
import { CreemForm } from './creem-form';
import { SupabaseForm } from './supabase-form';
import { PolarForm } from './polar-form';
import { PaddleForm } from './paddle-form';
import { CloudflareR2Form } from './cloudflare-r2-form';
import { CloudflarePagesForm } from './cloudflare-pages-form';
import { CloudflareQueuesForm } from './cloudflare-queues-form';
import { CustomRestForm } from './custom-rest-form';
import { ConnectorAccountManager } from './connector-account-manager';
import { buildConnectorAccountViews } from '@/lib/connector-lifecycle';
import { ProductIngestionWizard } from './product-ingestion-wizard';

const catalog = [
  ['cloudflare', 'Cloudflare', 'Workers runtime plus R2 request, error, object, and storage evidence.'],
  ['cloudflare_pages', 'Cloudflare Pages', 'Privacy-minimized deployment outcomes, environment, cadence, and duration evidence.'],
  ['cloudflare_queues', 'Cloudflare Queues', 'Best-effort realtime backlog, oldest-message age, and paused-delivery evidence.'],
  ['google', 'Google Analytics & Search Console', 'Acquisition, engagement, queries, pages, positions, and clicks.'],
  ['bing', 'Bing Webmaster', 'Search clicks, impressions, CTR, query positions, and page performance.'],
  ['d1', 'Cloudflare D1 business data', 'Map your own SQL aggregates such as users, subscriptions, or revenue.'],
  ['stripe', 'Stripe revenue', 'Gross revenue, refunds, MRR, and paid customers in the account default currency.'],
  ['lemonsqueezy', 'Lemon Squeezy revenue', 'Orders, refunds, recurring revenue, paid customers, and trials with currency separation.'],
  ['creem', 'Creem revenue', 'Paid transactions, gross revenue, refunds, and chargebacks with production/test isolation.'],
  ['polar', 'Polar revenue', 'Net order revenue, refunds, and paid transactions with production/sandbox isolation.'],
  ['paddle', 'Paddle Billing revenue', 'Completed revenue, approved refunds, chargebacks, and recurring transaction evidence.'],
  ['supabase', 'Supabase operations', 'Project health plus aggregated Auth, Realtime, REST, and Storage request volume.'],
  ['github', 'GitHub product activity', 'Repository growth, delivery cadence, issue pressure, and maintenance freshness.'],
  ['vercel', 'Vercel deployments', 'Deployment volume, failures, build duration, production cadence, and release freshness.'],
  ['custom', 'Custom REST and ingestion', 'Pull contract-versioned metrics over safe HTTPS or push them through the normalized ingestion API.'],
] as const;

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const [connected, productRows, resources, accountMappings, recentRuns, competitorRows, schedules, entitlements, definitions] = workspace ? await Promise.all([getDb().select().from(connectorAccounts).where(eq(connectorAccounts.workspaceId, workspace.id)), getDb().select({ id: products.id, name: products.name }).from(products).where(eq(products.workspaceId, workspace.id)).orderBy(products.name), getDb().select().from(connectorResources).where(eq(connectorResources.workspaceId, workspace.id)), getDb().select({ connectorAccountId: productConnectorMappings.connectorAccountId, enabled: productConnectorMappings.enabled }).from(productConnectorMappings).where(eq(productConnectorMappings.workspaceId, workspace.id)), getDb().select({ connectorAccountId: syncRuns.connectorAccountId, status: syncRuns.status, errorCode: syncRuns.errorCode, createdAt: syncRuns.createdAt }).from(syncRuns).where(eq(syncRuns.workspaceId, workspace.id)).orderBy(desc(syncRuns.createdAt)).limit(100), getDb().select({ id: competitors.id, name: competitors.name, domain: competitors.domain }).from(competitors).where(eq(competitors.workspaceId, workspace.id)).orderBy(competitors.name), getDb().select().from(syncSchedules).where(eq(syncSchedules.workspaceId, workspace.id)), getWorkspaceEntitlements(workspace.id), getDb().select().from(calculatedMetricDefinitions).where(eq(calculatedMetricDefinitions.workspaceId, workspace.id)).orderBy(calculatedMetricDefinitions.name)]) : [[], [], [], [], [], [], [], null, []];
  const query = await searchParams;
  const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const accountViews = buildConnectorAccountViews(connected, accountMappings, recentRuns);
  return <div className="app-page"><header className="app-page-head"><div><span>DATA LAYER</span><h1>Data sources</h1><p>Credentials belong to this workspace and are never bundled with the public repository.</p></div></header>
    <section className="resource-grid">{catalog.map(([provider, name, copy]) => {
      const accounts = connected.filter((item) => item.provider === provider && item.status !== 'disabled');
      return <article className="resource-card" id={`connector-${provider}`} key={provider}><span className="status-pill">{accounts.length ? `${accounts.length} configured` : 'Not connected'}</span><h2>{name}</h2><p>{copy}</p><footer><span>{accounts.some((item) => item.status === 'connected') ? 'Healthy connection' : 'Configuration required'}</span><a href="/docs">Setup guide →</a></footer></article>;
    })}</section><ProductIngestionWizard products={productRows} canManage={canManage} /><ConnectorAccountManager accounts={accountViews} canManage={canManage} /><div className="section-label"><span>AUTOMATION</span><h2>Keep connected evidence current</h2></div><SyncScheduleForm schedules={schedules} minimumMinutes={entitlements?.minimumSyncMinutes || 1440} canManage={canManage} /><div className="section-label"><span>CLOUDFLARE OPERATIONS</span><h2>Connect an account and map a Worker</h2></div><CloudflareForm products={productRows} /><div className="section-label"><span>CLOUDFLARE R2</span><h2>Connect bucket operations and storage evidence</h2></div><CloudflareR2Form products={productRows} /><div className="section-label"><span>CLOUDFLARE PAGES</span><h2>Connect privacy-minimized deployment evidence</h2></div><CloudflarePagesForm products={productRows} /><div className="section-label"><span>GOOGLE ACQUISITION</span><h2>Discover and map GA4 and Search Console</h2></div><GoogleControls accounts={connected.filter((account) => account.provider === 'google' && account.status !== 'disabled').map((account) => ({ id: account.id, displayName: account.displayName, status: account.status, lastCheckedAt: account.lastCheckedAt }))} resources={resources} products={productRows} initialStatus={query.google} /><div className="section-label"><span>BING SEARCH</span><h2>Discover and map Bing Webmaster sites</h2></div><BingControls accounts={connected.filter((account) => account.provider === 'bing' && account.status !== 'disabled').map((account) => ({ id: account.id, displayName: account.displayName, status: account.status, lastCheckedAt: account.lastCheckedAt }))} resources={resources} products={productRows} /><div className="section-label"><span>STRIPE REVENUE</span><h2>Connect commercial evidence</h2></div><StripeForm products={productRows} /><div className="section-label"><span>LEMON SQUEEZY REVENUE</span><h2>Connect merchant and subscription evidence</h2></div><LemonSqueezyForm products={productRows} /><div className="section-label"><span>GITHUB PRODUCT ACTIVITY</span><h2>Connect repository growth and delivery evidence</h2></div><GitHubForm products={productRows} /><div className="section-label"><span>VERCEL DEPLOYMENT HEALTH</span><h2>Connect deployment cadence and failure evidence</h2></div><VercelForm products={productRows} /><div className="section-label"><span>BUSINESS METRICS</span><h2>Map read-only Cloudflare D1 aggregates</h2></div><D1Form products={productRows} /><div className="section-label"><span>CALCULATED METRICS</span><h2>Turn normalized inputs into deterministic ratios and KPIs</h2></div><CalculatedMetricForm definitions={definitions} canManage={canManage} /><div className="section-label"><span>COMPETITOR INTELLIGENCE</span><h2>Track comparable evidence with provenance</h2></div><CompetitorForm products={productRows} competitors={competitorRows} /><div className="section-label"><span>CUSTOM REST METRICS</span><h2>Pull your product KPIs from a safe JSON endpoint</h2></div><CustomRestForm products={productRows} connections={connected.filter((account) => account.provider === 'custom').map((account) => ({ id: account.id, displayName: account.displayName, status: account.status }))} canManage={canManage} /><div className="section-label"><span>OPEN INGESTION</span><h2>Import normalized metrics now</h2></div><MetricImportForm products={productRows} />
    <div className="section-label"><span>CREEM REVENUE</span><h2>Connect AI SaaS payment evidence</h2></div><CreemForm products={productRows} />
    <div className="section-label"><span>POLAR REVENUE</span><h2>Connect developer-first merchant evidence</h2></div><PolarForm products={productRows} />
    <div className="section-label"><span>PADDLE BILLING REVENUE</span><h2>Connect merchant-of-record transaction evidence</h2></div><PaddleForm products={productRows} />
    <div className="section-label"><span>SUPABASE OPERATIONS</span><h2>Connect backend request and project-health evidence</h2></div><SupabaseForm products={productRows} />
    <div className="section-label"><span>CLOUDFLARE QUEUES</span><h2>Connect queue pressure and delivery-state evidence</h2></div><CloudflareQueuesForm products={productRows} />
  </div>;
}
