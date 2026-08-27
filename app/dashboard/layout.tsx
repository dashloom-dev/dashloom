import Link from 'next/link';
import { BarChart3, Bot, Boxes, Cable, Clock3, LayoutDashboard, ListChecks, RadioTower, Rocket, Settings, Store } from 'lucide-react';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { Brand } from '@/components/brand';
import { DashboardLanguage } from './dashboard-language';
import { DashboardAccountMenu } from './dashboard-account-menu';
import './product.css';
import './readability.css';

export const dynamic = 'force-dynamic';

const navigation = [
  ['/dashboard', 'Overview', '总览', LayoutDashboard],
  ['/dashboard/products', 'Products', '产品', Boxes],
  ['/dashboard/sources', 'Data sources', '数据源', Cable],
  ['/dashboard/agent', 'Dashloom Agent', 'Dashloom Agent', Bot],
  ['/dashboard/tasks', 'Agent tasks', 'Agent 任务', Clock3],
  ['/dashboard/agent/radar', 'Signal radar', '信号雷达', RadioTower],
  ['/dashboard/actions', 'Agent actions', 'Agent 行动', ListChecks],
  ['/dashboard/missions', 'Growth missions', '增长任务', Rocket],
  ['/dashboard/marketplace', 'Marketplace', '市场', Store],
  ['/dashboard/reports', 'Reports', '报告', BarChart3],
  ['/dashboard/settings', 'Settings', '设置', Settings],
] as const;

const intelligenceViews = [
  ['/dashboard/views/indie_hacker', 'Indie Hacker', '独立开发者'],
  ['/dashboard/views/saas_revenue', 'SaaS Revenue', 'SaaS 收入'],
  ['/dashboard/views/seo_growth', 'SEO Growth', 'SEO 增长'],
  ['/dashboard/views/cloudflare_operations', 'Cloudflare Ops', 'Cloudflare 运维'],
  ['/dashboard/views/agency_client', 'Agency Client', 'Agency 客户'],
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const zh = workspace?.locale === 'zh';
  return <main className="product-app">
    <DashboardLanguage locale={workspace?.locale || 'en'} />
    <aside className="product-sidebar">
      <Link className="brand" href="/dashboard"><Brand priority /></Link>
      <div className="workspace-switcher"><small>{zh ? '社区工作空间' : 'COMMUNITY WORKSPACE'}</small><strong>{workspace?.name || (zh ? '工作空间设置' : 'Workspace setup')}</strong><span>{zh ? '自部署 · 自带模型' : 'self-hosted · BYOK'}</span></div>
      <nav aria-label={zh ? '产品导航' : 'Product navigation'}>{navigation.map(([href, en, cn, Icon]) => <Link href={href} key={href}><Icon size={19} /><span>{zh ? cn : en}</span></Link>)}</nav>
      <div className="view-navigation"><small>{zh ? '智能视图' : 'INTELLIGENCE VIEWS'}</small>{intelligenceViews.map(([href, en, cn], index) => <Link href={href} key={href}><b>0{index + 1}</b><span>{zh ? cn : en}</span></Link>)}</div>
      <DashboardAccountMenu user={{ name: user.name, email: user.email }} workspace={workspace ? { name: workspace.name, locale: workspace.locale, timezone: workspace.timezone } : null} />
    </aside>
    <section className="product-content">{children}</section>
  </main>;
}
