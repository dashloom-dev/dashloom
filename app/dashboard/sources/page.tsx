import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { calculatedMetricDefinitions, connectorAccounts, connectorResources, competitors, productConnectorMappings, products, syncRuns, syncSchedules } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { MetricImportForm } from './metric-import-form';
import { GoogleControls } from './google-controls';
import { BingControls } from './bing-controls';
import { D1Form } from './d1-form';
import { CompetitorForm } from './competitor-form';
import { SyncScheduleForm } from './sync-schedule-form';
import { getWorkspaceEntitlements } from '@/lib/entitlements';
import { StripeForm } from './stripe-form';
import { LemonSqueezyForm } from './lemon-squeezy-form';
import { CalculatedMetricForm } from './calculated-metric-form';
import { CreemForm } from './creem-form';
import { PolarForm } from './polar-form';
import { PaddleForm } from './paddle-form';
import { CustomRestForm } from './custom-rest-form';
import { ConnectorAccountManager } from './connector-account-manager';
import { buildConnectorAccountViews } from '@/lib/connector-lifecycle';
import { ProductIngestionWizard } from './product-ingestion-wizard';
import Link from 'next/link';
import { DashboardTabs } from '../dashboard-tabs';

const catalog = [
  ['google', 'Google Analytics & Search Console', 'Google Analytics 与 Search Console', 'Acquisition, engagement, queries, pages, positions, and clicks.', '获客、参与度、搜索词、页面、排名和点击。'],
  ['bing', 'Bing Webmaster', 'Bing Webmaster', 'Search clicks, impressions, CTR, query positions, and page performance.', '搜索点击、展示、点击率、关键词排名和页面表现。'],
  ['d1', 'Cloudflare D1 business data', 'Cloudflare D1 业务数据', 'Read aggregate users, subscriptions, orders, and revenue with validated read-only SQL.', '通过经过验证的只读 SQL，读取用户、订阅、订单和收入等聚合业务指标。'],
  ['stripe', 'Stripe revenue', 'Stripe 收入', 'Gross revenue, refunds, MRR, and paid customers in the account default currency.', '按账户默认币种读取总收入、退款、MRR 和付费客户。'],
  ['lemonsqueezy', 'Lemon Squeezy revenue', 'Lemon Squeezy 收入', 'Orders, refunds, recurring revenue, paid customers, and trials with currency separation.', '按币种区分订单、退款、经常性收入、付费客户和试用。'],
  ['creem', 'Creem revenue', 'Creem 收入', 'Paid transactions, gross revenue, refunds, and chargebacks with production/test isolation.', '在生产与测试环境隔离下读取支付交易、总收入、退款和拒付。'],
  ['polar', 'Polar revenue', 'Polar 收入', 'Net order revenue, refunds, and paid transactions with production/sandbox isolation.', '在生产与沙盒环境隔离下读取订单净收入、退款和支付交易。'],
  ['paddle', 'Paddle Billing revenue', 'Paddle Billing 收入', 'Completed revenue, approved refunds, chargebacks, and recurring transaction evidence.', '读取已完成收入、已批准退款、拒付和经常性交易证据。'],
  ['custom', 'Custom REST and ingestion', '自定义 REST 与导入', 'Pull contract-versioned metrics over safe HTTPS or push them through the normalized ingestion API.', '通过安全 HTTPS 拉取带版本契约的指标，或通过标准化导入 API 推送。'],
] as const;

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const [connected, productRows, resources, accountMappings, recentRuns, competitorRows, schedules, entitlements, definitions] = workspace ? await Promise.all([getDb().select().from(connectorAccounts).where(eq(connectorAccounts.workspaceId, workspace.id)), getDb().select({ id: products.id, name: products.name }).from(products).where(eq(products.workspaceId, workspace.id)).orderBy(products.name), getDb().select().from(connectorResources).where(eq(connectorResources.workspaceId, workspace.id)), getDb().select({ connectorAccountId: productConnectorMappings.connectorAccountId, enabled: productConnectorMappings.enabled }).from(productConnectorMappings).where(eq(productConnectorMappings.workspaceId, workspace.id)), getDb().select({ connectorAccountId: syncRuns.connectorAccountId, status: syncRuns.status, errorCode: syncRuns.errorCode, createdAt: syncRuns.createdAt }).from(syncRuns).where(eq(syncRuns.workspaceId, workspace.id)).orderBy(desc(syncRuns.createdAt)).limit(100), getDb().select({ id: competitors.id, name: competitors.name, domain: competitors.domain }).from(competitors).where(eq(competitors.workspaceId, workspace.id)).orderBy(competitors.name), getDb().select().from(syncSchedules).where(eq(syncSchedules.workspaceId, workspace.id)), getWorkspaceEntitlements(workspace.id), getDb().select().from(calculatedMetricDefinitions).where(eq(calculatedMetricDefinitions.workspaceId, workspace.id)).orderBy(calculatedMetricDefinitions.name)]) : [[], [], [], [], [], [], [], null, []];
  const query = await searchParams;
  const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const accountViews = buildConnectorAccountViews(connected, accountMappings, recentRuns);
  const zh = workspace?.locale === 'zh';
  const title = (eyebrow: string, heading: string) => <div className="section-label"><span>{eyebrow}</span><h2>{heading}</h2></div>;
  const googleAccounts = connected.filter((account) => account.provider === 'google' && account.status !== 'disabled').map((account) => ({ id: account.id, displayName: account.displayName, status: account.status, lastCheckedAt: account.lastCheckedAt }));
  const bingAccounts = connected.filter((account) => account.provider === 'bing' && account.status !== 'disabled').map((account) => ({ id: account.id, displayName: account.displayName, status: account.status, lastCheckedAt: account.lastCheckedAt }));
  const customAccounts = connected.filter((account) => account.provider === 'custom').map((account) => ({ id: account.id, displayName: account.displayName, status: account.status }));
  const overview = <div className="tab-section-stack"><section className="resource-grid">{catalog.map(([provider, name, nameZh, copy, copyZh]) => { const accounts = connected.filter((item) => item.provider === provider && item.status !== 'disabled'); return <article className="resource-card" id={`connector-${provider}`} key={provider}><span className="status-pill">{accounts.length ? `${accounts.length} ${zh ? '个配置' : 'configured'}` : zh ? '未连接' : 'Not connected'}</span><h2>{zh ? nameZh : name}</h2><p>{zh ? copyZh : copy}</p><footer><span>{accounts.some((item) => item.status === 'connected') ? (zh ? '连接正常' : 'Healthy connection') : (zh ? '需要配置' : 'Configuration required')}</span><Link href="/docs">{zh ? '设置指南' : 'Setup guide'} →</Link></footer></article>; })}</section><ProductIngestionWizard products={productRows} canManage={canManage} /><ConnectorAccountManager accounts={accountViews} canManage={canManage} />{title(zh ? '自动化' : 'AUTOMATION', zh ? '让连接的数据持续保持最新' : 'Keep connected evidence current')}<SyncScheduleForm schedules={schedules} minimumMinutes={entitlements?.minimumSyncMinutes || 1440} canManage={canManage} zh={zh} /></div>;
  const business = <div className="tab-section-stack">{title('CLOUDFLARE D1', zh ? '读取用户、订单、订阅与收入等业务聚合' : 'Read business aggregates such as users, orders, subscriptions, and revenue')}<D1Form products={productRows} /></div>;
  const growth = <div className="tab-section-stack">{title('GOOGLE', zh ? '发现并映射 GA4 与 Search Console' : 'Discover and map GA4 and Search Console')}<GoogleControls accounts={googleAccounts} resources={resources} products={productRows} initialStatus={query.google} />{title('BING', zh ? '发现并映射 Bing Webmaster 站点' : 'Discover and map Bing Webmaster sites')}<BingControls accounts={bingAccounts} resources={resources} products={productRows} />{title('STRIPE', zh ? '连接收入证据' : 'Connect commercial evidence')}<StripeForm products={productRows} />{title('LEMON SQUEEZY', zh ? '连接商户和订阅证据' : 'Connect merchant and subscription evidence')}<LemonSqueezyForm products={productRows} />{title('CREEM', zh ? '连接 AI SaaS 支付证据' : 'Connect AI SaaS payment evidence')}<CreemForm products={productRows} />{title('POLAR', zh ? '连接开发者商户证据' : 'Connect developer-first merchant evidence')}<PolarForm products={productRows} />{title('PADDLE', zh ? '连接 Merchant of Record 交易证据' : 'Connect merchant-of-record transaction evidence')}<PaddleForm products={productRows} /></div>;
  const custom = <div className="tab-section-stack">{title(zh ? '计算指标' : 'CALCULATED METRICS', zh ? '创建确定性的比例和 KPI' : 'Turn normalized inputs into deterministic ratios and KPIs')}<CalculatedMetricForm definitions={definitions} canManage={canManage} />{title(zh ? '竞品情报' : 'COMPETITOR INTELLIGENCE', zh ? '跟踪带来源的可比证据' : 'Track comparable evidence with provenance')}<CompetitorForm products={productRows} competitors={competitorRows} />{title('CUSTOM REST', zh ? '从安全的 JSON 端点读取 KPI' : 'Pull product KPIs from a safe JSON endpoint')}<CustomRestForm products={productRows} connections={customAccounts} canManage={canManage} />{title(zh ? '开放导入' : 'OPEN INGESTION', zh ? '立即导入标准化指标' : 'Import normalized metrics now')}<MetricImportForm products={productRows} /></div>;
  return <div className="app-page"><header className="app-page-head"><div><span>{zh ? '数据层' : 'DATA LAYER'}</span><h1>{zh ? '数据源' : 'Data sources'}</h1><p>{zh ? '这里只连接真实业务、获客、搜索和收入数据；Workers、Vercel、AWS 与技术框架属于部署配置，不是业务数据源。' : 'Connect real business, acquisition, search, and revenue data here; Workers, Vercel, AWS, and frameworks belong to deployment configuration, not business data sources.'}</p></div></header><DashboardTabs tabs={[
    { id: 'overview', label: zh ? '概览与同步' : 'Overview & sync', description: zh ? '连接状态、导入与计划任务' : 'Status, ingestion, and schedules', content: overview },
    { id: 'business', label: zh ? '业务数据' : 'Business data', description: 'Cloudflare D1', content: business },
    { id: 'growth', label: zh ? '增长与收入' : 'Growth & revenue', description: zh ? '流量、搜索与支付平台' : 'Acquisition, search, and billing', content: growth },
    { id: 'custom', label: zh ? '自定义与计算' : 'Custom & calculated', description: zh ? '计算指标、REST、竞品与导入' : 'Calculated metrics, REST, competitors, and ingestion', content: custom },
  ]} /></div>;
}
