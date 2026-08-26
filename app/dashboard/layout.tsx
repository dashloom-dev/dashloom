import Link from 'next/link';
import { BarChart3, Bot, Boxes, Cable, Clock3, LayoutDashboard, ListChecks, RadioTower, Rocket, Settings, Store } from 'lucide-react';
import { requireServerSession } from '@/lib/session';
import { getPrimaryWorkspace } from '@/lib/workspaces';
import { SignOutButton } from './sign-out-button';
import './product.css';
import './readability.css';

const navigation = [
  ['/dashboard', 'Overview', LayoutDashboard],
  ['/dashboard/products', 'Products', Boxes],
  ['/dashboard/sources', 'Data sources', Cable],
  ['/dashboard/agent', 'Dashloom Agent', Bot],
  ['/dashboard/tasks', 'Agent tasks', Clock3],
  ['/dashboard/agent/radar', 'Signal radar', RadioTower],
  ['/dashboard/actions', 'Agent actions', ListChecks],
  ['/dashboard/missions', 'Growth missions', Rocket],
  ['/dashboard/marketplace', 'Marketplace', Store],
  ['/dashboard/reports', 'Reports', BarChart3],
  ['/dashboard/settings', 'Settings', Settings],
] as const;

const intelligenceViews = [
  ['/dashboard/views/indie_hacker', 'Indie Hacker'],
  ['/dashboard/views/saas_revenue', 'SaaS Revenue'],
  ['/dashboard/views/seo_growth', 'SEO Growth'],
  ['/dashboard/views/cloudflare_operations', 'Cloudflare Ops'],
  ['/dashboard/views/agency_client', 'Agency Client'],
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireServerSession();
  const workspace = await getPrimaryWorkspace(user.id);
  return <main className="product-app">
    <aside className="product-sidebar">
      <Link className="brand" href="/dashboard"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Dashloom</span></Link>
      <div className="workspace-switcher"><small>COMMUNITY WORKSPACE</small><strong>{workspace?.name || 'Workspace setup'}</strong><span>self-hosted · BYOK</span></div>
      <nav aria-label="Product navigation">{navigation.map(([href, label, Icon]) => <Link href={href} key={href}><Icon size={19} /><span>{label}</span></Link>)}</nav>
      <div className="view-navigation"><small>INTELLIGENCE VIEWS</small>{intelligenceViews.map(([href, label], index) => <Link href={href} key={href}><b>0{index + 1}</b><span>{label}</span></Link>)}</div>
      <div className="product-user"><div>{user.name.slice(0, 2).toUpperCase()}</div><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
      <SignOutButton />
    </aside>
    <section className="product-content">{children}</section>
  </main>;
}
