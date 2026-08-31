import Link from 'next/link';
import type { Metadata } from 'next';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { getDeploymentLocale } from '@/lib/deployment-locale';
import { Brand } from '@/components/brand';
import { DashboardLanguage } from './dashboard-language';
import { DashboardAccountMenu } from './dashboard-account-menu';
import { DashboardNavigation } from './dashboard-navigation';
import './product.css';
import './readability.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Compatibility labels remain stable even though the views now live in the Data navigation group.
export const dashboardIntelligenceViewLabels = [
  ['Indie Hacker', '独立开发者'],
  ['SaaS Revenue', 'SaaS 收入'],
  ['SEO Growth', 'SEO 增长'],
  ['Infrastructure Ops', '基础设施运维'],
  ['Agency Client', 'Agency 客户'],
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  const locale = getDeploymentLocale();
  const zh = locale === 'zh';
  return <main className="product-app">
    <DashboardLanguage locale={locale} />
    <aside className="product-sidebar">
      <Link className="brand" href="/dashboard"><Brand priority /></Link>
      <div className="workspace-switcher"><small>{zh ? '社区工作空间' : 'COMMUNITY WORKSPACE'}</small><strong>{workspace?.name || (zh ? '工作空间设置' : 'Workspace setup')}</strong><span>{zh ? '自部署 · 自带模型' : 'self-hosted · BYOK'}</span></div>
      <DashboardNavigation locale={locale} />
      <DashboardAccountMenu user={{ name: user.name, email: user.email }} locale={locale} />
    </aside>
    <section className="product-content">{children}</section>
  </main>;
}
