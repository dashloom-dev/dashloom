import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { calculatedMetricDefinitions, connectorAccounts, connectorResources, competitors, productConnectorMappings, products, syncRuns, syncSchedules } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getDeploymentLocale } from '@/lib/deployment-locale';
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
import { DashboardTabs } from '../dashboard-tabs';
import { CloudflareForm } from './cloudflare-form';
import { CloudflareR2Form } from './cloudflare-r2-form';
import { CloudflarePagesForm } from './cloudflare-pages-form';
import { CloudflareQueuesForm } from './cloudflare-queues-form';
import { GitHubForm } from './github-form';
import { VercelForm } from './vercel-form';

const catalog = [
  ['google', 'Google Analytics & Search Console', 'Google Analytics 与 Search Console', 'Acquisition, engagement, queries, pages, positions, and clicks.', '获客、参与度、搜索词、页面、排名和点击。'],
  ['bing', 'Bing Webmaster', 'Bing Webmaster', 'Search clicks, impressions, CTR, query positions, and page performance.', '搜索点击、展示、点击率、关键词排名和页面表现。'],
  ['d1', 'Cloudflare D1 business data', 'Cloudflare D1 业务数据', 'Read aggregate users, subscriptions, orders, and revenue with validated read-only SQL.', '通过经过验证的只读 SQL，读取用户、订阅、订单和收入等聚合业务指标。'],
  ['stripe', 'Stripe revenue', 'Stripe 收入', 'Gross revenue, refunds, MRR, and paid customers in the account default currency.', '按账户默认币种读取总收入、退款、MRR 和付费客户。'],
  ['lemonsqueezy', 'Lemon Squeezy revenue', 'Lemon Squeezy 收入', 'Orders, refunds, recurring revenue, paid customers, and trials with currency separation.', '按币种区分订单、退款、经常性收入、付费客户和试用。'],
  ['creem', 'Creem revenue', 'Creem 收入', 'Paid transactions, gross revenue, refunds, and chargebacks with production/test isolation.', '在生产与测试环境隔离下读取支付交易、总收入、退款和拒付。'],
  ['polar', 'Polar revenue', 'Polar 收入', 'Net order revenue, refunds, and paid transactions with production/sandbox isolation.', '在生产与沙盒环境隔离下读取订单净收入、退款和支付交易。'],
  ['paddle', 'Paddle Billing revenue', 'Paddle Billing 收入', 'Completed revenue, approved refunds, chargebacks, and recurring transaction totals.', '读取已完成收入、已批准退款、拒付和经常性交易汇总。'],
  ['cloudflare', 'Cloudflare Workers', 'Cloudflare Workers', 'Runtime requests, errors, CPU time, and status from an explicitly authorized Worker.', '从明确授权的 Worker 读取请求、错误、CPU 时间和运行状态。'],
  ['cloudflare_r2', 'Cloudflare R2', 'Cloudflare R2', 'Bucket usage and error totals without reading objects or object names.', '读取存储桶用量和错误汇总，不读取对象或对象名称。'],
  ['cloudflare_pages', 'Cloudflare Pages', 'Cloudflare Pages', 'Deployment outcomes and delivery health without storing source code or build secrets.', '读取部署结果与交付健康度，不保存源代码或构建密钥。'],
  ['cloudflare_queues', 'Cloudflare Queues', 'Cloudflare Queues', 'Backlog, oldest-message age, and paused state without reading message bodies.', '读取积压量、最旧消息时长和暂停状态，不读取消息正文。'],
  ['github', 'GitHub', 'GitHub', 'Repository activity and health using metadata-only, read-only access.', '通过只读元数据权限读取仓库活动与健康度。'],
  ['vercel', 'Vercel', 'Vercel', 'Project deployment summaries and delivery health from a scoped access token.', '通过限定范围的访问令牌读取项目部署摘要与交付健康度。'],
  ['custom', 'Custom REST and ingestion', '自定义 REST 与导入', 'Pull metrics from an HTTPS endpoint or send them through the Metrics API.', '从 HTTPS 端点拉取指标，或通过 Metrics API 发送。'],
] as const;

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const [connected, productRows, resources, accountMappings, recentRuns, competitorRows, schedules, entitlements, definitions] = workspace ? await Promise.all([getDb().select().from(connectorAccounts).where(eq(connectorAccounts.workspaceId, workspace.id)), getDb().select({ id: products.id, name: products.name }).from(products).where(eq(products.workspaceId, workspace.id)).orderBy(products.name), getDb().select().from(connectorResources).where(eq(connectorResources.workspaceId, workspace.id)), getDb().select({ connectorAccountId: productConnectorMappings.connectorAccountId, enabled: productConnectorMappings.enabled }).from(productConnectorMappings).where(eq(productConnectorMappings.workspaceId, workspace.id)), getDb().select({ connectorAccountId: syncRuns.connectorAccountId, status: syncRuns.status, errorCode: syncRuns.errorCode, createdAt: syncRuns.createdAt }).from(syncRuns).where(eq(syncRuns.workspaceId, workspace.id)).orderBy(desc(syncRuns.createdAt)).limit(100), getDb().select({ id: competitors.id, name: competitors.name, domain: competitors.domain }).from(competitors).where(eq(competitors.workspaceId, workspace.id)).orderBy(competitors.name), getDb().select().from(syncSchedules).where(eq(syncSchedules.workspaceId, workspace.id)), getWorkspaceEntitlements(workspace.id), getDb().select().from(calculatedMetricDefinitions).where(eq(calculatedMetricDefinitions.workspaceId, workspace.id)).orderBy(calculatedMetricDefinitions.name)]) : [[], [], [], [], [], [], [], null, []];
  const query = await searchParams;
  const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const accountViews = buildConnectorAccountViews(connected, accountMappings, recentRuns);
  const zh = getDeploymentLocale() === 'zh';
  const title = (eyebrow: string, heading: string) => <div className="section-label"><span>{eyebrow}</span><h2>{heading}</h2></div>;
  const googleAccounts = connected.filter((account) => account.provider === 'google' && account.status !== 'disabled').map((account) => ({ id: account.id, displayName: account.displayName, status: account.status, lastCheckedAt: account.lastCheckedAt }));
  const bingAccounts = connected.filter((account) => account.provider === 'bing' && account.status !== 'disabled').map((account) => ({ id: account.id, displayName: account.displayName, status: account.status, lastCheckedAt: account.lastCheckedAt }));
  const customAccounts = connected.filter((account) => account.provider === 'custom').map((account) => ({ id: account.id, displayName: account.displayName, status: account.status }));
  const overview = <div className="tab-section-stack"><section className="resource-grid">{catalog.map(([provider, name, nameZh, copy, copyZh]) => { const accounts = connected.filter((item) => item.provider === provider && item.status !== 'disabled'); return <article className="resource-card" id={`connector-${provider}`} key={provider}><span className="status-pill">{accounts.length ? `${accounts.length} ${zh ? '个配置' : 'configured'}` : zh ? '未连接' : 'Not connected'}</span><h2>{zh ? nameZh : name}</h2><p>{zh ? copyZh : copy}</p><footer><span>{accounts.some((item) => item.status === 'connected') ? (zh ? '连接正常' : 'Healthy connection') : (zh ? '需要配置' : 'Configuration required')}</span><a href="https://github.com/dashloom-dev/dashloom/tree/main/docs">{zh ? '设置指南' : 'Setup guide'} ↗</a></footer></article>; })}</section><ProductIngestionWizard products={productRows} canManage={canManage} zh={zh} /><ConnectorAccountManager accounts={accountViews} canManage={canManage} />{title(zh ? '自动化' : 'AUTOMATION', zh ? '让连接的数据持续保持最新' : 'Keep connected evidence current')}<SyncScheduleForm schedules={schedules} minimumMinutes={entitlements?.minimumSyncMinutes || 1440} canManage={canManage} zh={zh} /></div>;
  const business = <div className="tab-section-stack">{title('CLOUDFLARE D1', zh ? '读取用户、订单、订阅与收入等业务聚合' : 'Read business aggregates such as users, orders, subscriptions, and revenue')}<D1Form products={productRows} zh={zh} /></div>;
  const growth = <DashboardTabs initialTab="google" tabs={[
    { id: 'google', label: 'Google', description: 'GA4 · Search Console', content: <div className="tab-section-stack">{title('GOOGLE', zh ? '发现并映射 GA4 与 Search Console' : 'Discover and map GA4 and Search Console')}<GoogleControls accounts={googleAccounts} resources={resources} products={productRows} initialStatus={query.google} /></div> },
    { id: 'bing', label: 'Bing', description: 'Webmaster', content: <div className="tab-section-stack">{title('BING', zh ? '发现并映射 Bing Webmaster 站点' : 'Discover and map Bing Webmaster sites')}<BingControls accounts={bingAccounts} resources={resources} products={productRows} /></div> },
    { id: 'stripe', label: 'Stripe', description: zh ? '收入与订阅' : 'Revenue & subscriptions', content: <div className="tab-section-stack">{title('STRIPE', zh ? '导入收入、退款和订阅数据' : 'Import revenue, refunds, and subscriptions')}<StripeForm products={productRows} /></div> },
    { id: 'lemonsqueezy', label: 'Lemon Squeezy', description: zh ? '订单与订阅' : 'Orders & subscriptions', content: <div className="tab-section-stack">{title('LEMON SQUEEZY', zh ? '连接商户和订阅证据' : 'Connect merchant and subscription evidence')}<LemonSqueezyForm products={productRows} /></div> },
    { id: 'creem', label: 'Creem', description: zh ? '交易与退款' : 'Payments & refunds', content: <div className="tab-section-stack">{title('CREEM', zh ? '导入交易、收入和退款数据' : 'Import payments, revenue, and refunds')}<CreemForm products={productRows} /></div> },
    { id: 'polar', label: 'Polar', description: zh ? '订单与退款' : 'Orders & refunds', content: <div className="tab-section-stack">{title('POLAR', zh ? '连接开发者商户证据' : 'Connect developer-first merchant evidence')}<PolarForm products={productRows} /></div> },
    { id: 'paddle', label: 'Paddle', description: zh ? '交易与拒付' : 'Transactions & disputes', content: <div className="tab-section-stack">{title('PADDLE', zh ? '导入交易、退款和拒付数据' : 'Import transactions, refunds, and chargebacks')}<PaddleForm products={productRows} /></div> },
  ]} />;
  const infrastructure = <DashboardTabs initialTab="workers" tabs={[
    { id: 'workers', label: 'Cloudflare Workers', description: zh ? '请求、错误与 CPU' : 'Requests, errors & CPU', content: <div className="tab-section-stack">{title('CLOUDFLARE WORKERS', zh ? '导入请求、错误和 CPU 时间' : 'Import requests, errors, and CPU time')}<CloudflareForm products={productRows} /></div> },
    { id: 'r2', label: 'Cloudflare R2', description: zh ? '存储分析' : 'Storage analytics', content: <div className="tab-section-stack">{title('CLOUDFLARE R2', zh ? '连接存储健康证据' : 'Connect storage health evidence')}<CloudflareR2Form products={productRows} /></div> },
    { id: 'pages', label: 'Cloudflare Pages', description: zh ? '部署结果' : 'Deployment outcomes', content: <div className="tab-section-stack">{title('CLOUDFLARE PAGES', zh ? '连接 Pages 交付证据' : 'Connect Pages delivery evidence')}<CloudflarePagesForm products={productRows} /></div> },
    { id: 'queues', label: 'Cloudflare Queues', description: zh ? '队列健康' : 'Queue health', content: <div className="tab-section-stack">{title('CLOUDFLARE QUEUES', zh ? '连接队列积压与投递状态' : 'Connect queue backlog and delivery state')}<CloudflareQueuesForm products={productRows} /></div> },
    { id: 'github', label: 'GitHub', description: zh ? '代码交付信号' : 'Repository delivery', content: <div className="tab-section-stack">{title('GITHUB', zh ? '连接仓库活动与健康证据' : 'Connect repository activity and health')}<GitHubForm products={productRows} /></div> },
    { id: 'vercel', label: 'Vercel', description: zh ? '部署健康' : 'Deployment health', content: <div className="tab-section-stack">{title('VERCEL', zh ? '连接项目部署与交付证据' : 'Connect project deployment and delivery evidence')}<VercelForm products={productRows} /></div> },
  ]} />;
  const custom = <DashboardTabs initialTab="calculated" tabs={[
    { id: 'calculated', label: zh ? '计算指标' : 'Calculated metrics', description: zh ? '比例与 KPI' : 'Ratios & KPIs', content: <div className="tab-section-stack">{title(zh ? '计算指标' : 'CALCULATED METRICS', zh ? '用现有指标计算转化率和其他比例' : 'Calculate conversion rates and other ratios from existing metrics')}<CalculatedMetricForm definitions={definitions} canManage={canManage} /></div> },
    { id: 'competitors', label: zh ? '竞品数据' : 'Competitors', description: zh ? '手动导入的对比数据' : 'Imported comparison data', content: <div className="tab-section-stack">{title(zh ? '竞品数据' : 'COMPETITOR DATA', zh ? '记录竞品指标并标明来源' : 'Record competitor metrics and their source')}<CompetitorForm products={productRows} competitors={competitorRows} /></div> },
    { id: 'rest', label: 'Custom REST', description: zh ? '安全 JSON 端点' : 'Safe JSON endpoint', content: <div className="tab-section-stack">{title('CUSTOM REST', zh ? '从安全的 JSON 端点读取 KPI' : 'Pull product KPIs from a safe JSON endpoint')}<CustomRestForm products={productRows} connections={customAccounts} canManage={canManage} /></div> },
    { id: 'import', label: zh ? '开放导入' : 'Open ingestion', description: zh ? '标准化指标' : 'Normalized metrics', content: <div className="tab-section-stack">{title(zh ? '开放导入' : 'OPEN INGESTION', zh ? '立即导入标准化指标' : 'Import normalized metrics now')}<MetricImportForm products={productRows} /></div> },
  ]} />;
  return <div className="app-page"><header className="app-page-head"><div><span>{zh ? '连接与导入' : 'CONNECT & IMPORT'}</span><h1>{zh ? '数据源' : 'Data sources'}</h1><p>{zh ? '连接 Google、支付平台、Cloudflare 或数据库。每个连接都需要单独的只读授权，部署在某个平台不代表 Dashloom 自动获得读取权限。' : 'Connect Google, billing platforms, Cloudflare, or a database; every connector requires separate read-only authorization. Hosting on a platform does not give Dashloom access to its data.'}</p></div></header><DashboardTabs tabs={[
    { id: 'overview', label: zh ? '概览与同步' : 'Overview & sync', description: zh ? '连接状态、导入与计划任务' : 'Status, ingestion, and schedules', content: overview },
    { id: 'business', label: zh ? '业务数据' : 'Business data', description: 'Cloudflare D1', content: business },
    { id: 'growth', label: zh ? '增长与收入' : 'Growth & revenue', description: zh ? '流量、搜索与支付平台' : 'Acquisition, search, and billing', content: growth },
    { id: 'infrastructure', label: zh ? '基础设施与交付' : 'Infrastructure & delivery', description: zh ? '运行时、存储、队列、代码与部署' : 'Runtime, storage, queues, code, and deployments', content: infrastructure },
    { id: 'custom', label: zh ? '自定义与计算' : 'Custom & calculated', description: zh ? '计算指标、REST、竞品与导入' : 'Calculated metrics, REST, competitors, and ingestion', content: custom },
  ]} /></div>;
}
