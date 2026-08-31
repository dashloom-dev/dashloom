import { and, count, countDistinct, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { competitorMetricPoints, competitors, connectorAccounts, metricPoints, productConnectorMappings, products } from '@/db/schema';
import { jsonText } from '@/db/dialect';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { agentDefinitions, summarizeAgentReadiness, type AgentPreset } from '@/lib/agent-catalog';
import { buildProductDataCoverage } from '@/lib/product-data-coverage';
import { ProductLifecycleControls } from './product-form';
import Link from 'next/link';
import { getDeploymentLocale } from '@/lib/deployment-locale';

function day(offset: number) { return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10); }
const agentPresets = Object.keys(agentDefinitions) as AgentPreset[];

export default async function ProductsPage() {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const [rows, mappings, evidence, recentMetrics, recentCompetitors] = workspace ? await Promise.all([
    getDb().select().from(products).where(eq(products.workspaceId, workspace.id)).orderBy(products.name),
    getDb().select({ productId: productConnectorMappings.productId, source: productConnectorMappings.source, enabled: productConnectorMappings.enabled, accountStatus: connectorAccounts.status }).from(productConnectorMappings).innerJoin(connectorAccounts, eq(productConnectorMappings.connectorAccountId, connectorAccounts.id)).where(eq(productConnectorMappings.workspaceId, workspace.id)),
    getDb().select({ productId: metricPoints.productId, source: metricPoints.source, pointCount: count(), metricCount: countDistinct(metricPoints.metric), latestDate: sql<string>`max(${metricPoints.metricDate})` }).from(metricPoints).where(eq(metricPoints.workspaceId, workspace.id)).groupBy(metricPoints.productId, metricPoints.source),
    getDb().select({ productId: metricPoints.productId, metric: metricPoints.metric, source: metricPoints.source, domain: jsonText(metricPoints.dimensionsJson, 'domain'), metricDate: sql<string>`max(${metricPoints.metricDate})`, pointCount: count() }).from(metricPoints).where(and(eq(metricPoints.workspaceId, workspace.id), gte(metricPoints.metricDate, day(-13)))).groupBy(metricPoints.productId, metricPoints.metric, metricPoints.source, jsonText(metricPoints.dimensionsJson, 'domain')),
    getDb().select({ productId: competitors.productId, metric: competitorMetricPoints.metric, source: competitorMetricPoints.source, domain: jsonText(competitorMetricPoints.dimensionsJson, 'domain'), metricDate: sql<string>`max(${competitorMetricPoints.metricDate})`, pointCount: count() }).from(competitorMetricPoints).innerJoin(competitors, eq(competitorMetricPoints.competitorId, competitors.id)).where(and(eq(competitorMetricPoints.workspaceId, workspace.id), isNotNull(competitors.productId), gte(competitorMetricPoints.metricDate, day(-13)))).groupBy(competitors.productId, competitorMetricPoints.metric, competitorMetricPoints.source, jsonText(competitorMetricPoints.dimensionsJson, 'domain')),
  ]) : [[], [], [], [], []];
  const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role));
  const canDelete = workspace?.role === 'owner';
  const zh = getDeploymentLocale() === 'zh';

  return <div className="app-page">
    <header className="app-page-head"><div><span>{zh ? '产品设置' : 'PRODUCT SETTINGS'}</span><h1>{zh ? '产品列表' : 'Product list'}</h1><p>{zh ? '集中管理产品信息、状态和真实数据覆盖情况；添加产品与目标设置分别在独立页面完成。' : 'Manage product identity, lifecycle, and real data coverage without mixing creation and target configuration into this page.'}</p></div><div className="action-head-controls"><Link className="app-primary" href="/dashboard/products/new">{zh ? '添加产品' : 'Add product'}</Link><Link className="app-secondary" href="/dashboard/sources">{zh ? '连接数据' : 'Connect data'}</Link></div></header>
    <ProductLifecycleControls products={rows} canManage={canManage} canDelete={canDelete} />
    {rows.length > 0 && <><div className="section-label"><span>REAL DATA COVERAGE</span><h2>What is actually connected to each product</h2></div><section className="product-coverage-grid">{rows.map((product) => {
      const readiness = summarizeAgentReadiness(recentMetrics.filter((item) => item.productId === product.id), recentCompetitors.filter((item) => item.productId === product.id));
      const coverage = buildProductDataCoverage({ productId: product.id, mappings, evidence, readiness });
      return <article className="product-coverage-card" key={product.id} data-status={coverage.status}>
        <header><div><span>{product.category || 'PRODUCT'}</span><h2>{product.name}</h2><p>{product.domain || 'No public domain configured'}</p></div><b>{coverage.status.replaceAll('_', ' ')}</b></header>
        <div className="coverage-stats"><span><strong>{coverage.liveSourceCount}/{coverage.sourceCount}</strong><small>fresh sources</small></span><span><strong>{coverage.metricCount}</strong><small>real metrics</small></span><span><strong>{coverage.pointCount}</strong><small>stored points</small></span><span><strong>{coverage.latestDate || '—'}</strong><small>latest evidence</small></span></div>
        <div className="coverage-block"><strong>Data sources</strong><div className="coverage-chips">{coverage.sources.map((source) => <span key={source.source} data-state={source.state}>{source.source.replaceAll('_', ' ')} · {source.state.replaceAll('_', ' ')}{source.latestDate ? ` · ${source.latestDate}` : ''}</span>)}{!coverage.sources.length && <span data-state="attention">No mapping or imported evidence</span>}</div></div>
        <div className="coverage-block"><strong>Agents with matching evidence</strong><div className="coverage-chips">{agentPresets.map((preset) => <span key={preset} data-state={readiness[preset].ready ? 'fresh' : 'unavailable'}>{agentDefinitions[preset].name} · {readiness[preset].ready ? `${readiness[preset].eligiblePointCount + readiness[preset].competitorPointCount} points` : 'needs data'}</span>)}</div></div>
        <footer><small>{coverage.status === 'live' ? 'This product has evidence collected within the last three days.' : coverage.status === 'stale' ? 'Historical evidence exists, but no source is fresh within three days.' : coverage.status === 'awaiting_sync' ? 'A connector is mapped but has not written evidence yet.' : 'Create a source mapping or import normalized metrics.'}</small><Link href="/dashboard/sources">{coverage.status === 'live' ? 'Manage sources →' : 'Fix data coverage →'}</Link></footer>
      </article>;
    })}</section></>}
  </div>;
}
