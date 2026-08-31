import Link from 'next/link';
import { Target } from 'lucide-react';
import { and, eq, gte } from 'drizzle-orm';
import { getDb } from '@/db';
import { metricPoints, productGoals, products } from '@/db/schema';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { evaluateProductGoals } from '@/lib/product-goals';
import { getDeploymentLocale } from '@/lib/deployment-locale';
import { ProductGoalControls } from '../product-goal-controls';

function day(offset: number) { return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10); }

export default async function ProductGoalsPage() {
  const { user } = await requireServerSession(); const workspace = await getPrimaryWorkspace(user.id);
  const [rows, goalRows, goalMetricRows] = workspace ? await Promise.all([
    getDb().select().from(products).where(eq(products.workspaceId, workspace.id)).orderBy(products.name),
    getDb().select({ goal: productGoals, productName: products.name }).from(productGoals).innerJoin(products, eq(productGoals.productId, products.id)).where(eq(productGoals.workspaceId, workspace.id)).orderBy(productGoals.name),
    getDb().select({ productId: metricPoints.productId, source: metricPoints.source, metric: metricPoints.metric, metricDate: metricPoints.metricDate, value: metricPoints.value, dimensionsJson: metricPoints.dimensionsJson }).from(metricPoints).where(and(eq(metricPoints.workspaceId, workspace.id), gte(metricPoints.metricDate, day(-89)))).limit(20000),
  ]) : [[], [], []];
  const evaluatedGoals = evaluateProductGoals(goalRows.map(({ goal, productName }) => ({ ...goal, productName })), goalMetricRows, day(0));
  const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role)); const activeProducts = rows.filter((row) => row.status !== 'archived'); const zh = getDeploymentLocale() === 'zh';
  return <div className="app-page product-focused-page">
    <header className="app-page-head"><div><span>{zh ? '产品设置' : 'PRODUCT SETTINGS'}</span><h1>{zh ? '产品目标' : 'Product goals'}</h1><p>{zh ? '使用真实数据为每个产品设置可衡量、可追踪的经营目标。' : 'Define measurable outcomes separately from product identity and lifecycle management.'}</p></div><Link className="app-secondary" href="/dashboard/products">{zh ? '查看产品列表' : 'View product list'}</Link></header>
    {activeProducts.length ? <ProductGoalControls products={activeProducts.map((row) => ({ id: row.id, name: row.name }))} goals={goalRows.map(({ goal }, index) => ({ ...goal, ...evaluatedGoals[index] }))} canManage={canManage} /> : <section className="data-empty app-panel"><Target aria-hidden="true" /><h2>{zh ? '请先创建产品' : 'Create a product first'}</h2><p>{zh ? '每个目标必须归属于真实产品，系统才能在对应数据范围内计算进度。' : 'Every goal must belong to a real product so its progress can be evaluated against scoped evidence.'}</p><Link className="app-primary" href="/dashboard/products/new">{zh ? '添加产品' : 'Add product'}</Link></section>}
  </div>;
}
