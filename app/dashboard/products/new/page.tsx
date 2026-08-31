import Link from 'next/link';
import { ArrowRight, Boxes, Cable, Target } from 'lucide-react';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { getDeploymentLocale } from '@/lib/deployment-locale';
import { ProductForm } from '../product-form';

export default async function AddProductPage() {
  const { user } = await requireServerSession(); const workspace = await getPrimaryWorkspace(user.id); const canManage = Boolean(workspace && ['owner', 'admin'].includes(workspace.role)); const zh = getDeploymentLocale() === 'zh';
  return <div className="app-page product-focused-page">
    <header className="app-page-head"><div><span>{zh ? '产品设置' : 'PRODUCT SETTINGS'}</span><h1>{zh ? '添加产品' : 'Add product'}</h1><p>{zh ? '先建立产品的数据边界；后续数据源、目标、看板和 Agent 证据都会归属于该产品。' : 'Create the product boundary first. Data sources, targets, dashboards, and Agent evidence will all stay scoped to it.'}</p></div><Link className="app-secondary" href="/dashboard/products">{zh ? '查看产品列表' : 'View product list'}</Link></header>
    <section className="focused-form-panel"><div className="focused-form-intro"><span>{zh ? '第 1 步，共 3 步' : 'STEP 1 OF 3'}</span><h2>{zh ? '填写产品信息' : 'Define the product'}</h2><p>{zh ? '填写团队熟悉的产品名称和主域名，创建后仍可修改。' : 'Use the public name and primary domain your team recognizes. You can edit these details later.'}</p></div><ProductForm canManage={canManage} zh={zh} /></section>
    <section className="product-next-steps"><article><Boxes size={20} /><span><small>{zh ? '创建后' : 'AFTER CREATION'}</small><strong>{zh ? '检查产品列表' : 'Review the product list'}</strong><p>{zh ? '确认产品信息和当前状态。' : 'Confirm its identity and lifecycle state.'}</p></span><Link href="/dashboard/products"><ArrowRight size={16} /></Link></article><article><Cable size={20} /><span><small>{zh ? '连接数据' : 'CONNECT EVIDENCE'}</small><strong>{zh ? '添加数据源' : 'Add a data source'}</strong><p>{zh ? '接入分析、收入或基础设施数据。' : 'Map analytics, revenue, or infrastructure data.'}</p></span><Link href="/dashboard/sources"><ArrowRight size={16} /></Link></article><article><Target size={20} /><span><small>{zh ? '定义目标' : 'DEFINE SUCCESS'}</small><strong>{zh ? '创建产品目标' : 'Create a product goal'}</strong><p>{zh ? '让 Agent 围绕可衡量的经营目标工作。' : 'Give the Agent a measurable operating target.'}</p></span><Link href="/dashboard/products/goals"><ArrowRight size={16} /></Link></article></section>
  </div>;
}
