'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3, Bot, Boxes, Cable, ChartNoAxesCombined, ChevronDown, Clock3, Gauge,
  Layers3, LayoutDashboard, ListChecks, Plus, RadioTower, Rocket, Settings, Store, Target,
} from 'lucide-react';

type NavItem = { href: string; en: string; zh: string; icon: typeof LayoutDashboard; exact?: boolean };
type NavGroup = { en: string; zh: string; icon: typeof LayoutDashboard; href?: string; mobileHref?: string; children?: NavItem[] };

const groups: NavGroup[] = [
  { en: 'Overview', zh: '总览', icon: LayoutDashboard, href: '/dashboard' },
  { en: 'Product settings', zh: '产品设置', icon: Boxes, mobileHref: '/dashboard/products', children: [
    { href: '/dashboard/products/new', en: 'Add product', zh: '添加产品', icon: Plus, exact: true },
    { href: '/dashboard/products', en: 'Product list', zh: '产品列表', icon: Boxes, exact: true },
    { href: '/dashboard/products/goals', en: 'Product goals', zh: '产品目标', icon: Target, exact: true },
  ] },
  { en: 'Data', zh: '数据', icon: ChartNoAxesCombined, mobileHref: '/dashboard/data', children: [
    { href: '/dashboard/data', en: 'Data overview', zh: '数据总览', icon: Gauge },
    { href: '/dashboard/charts', en: 'Data charts', zh: '数据图表', icon: BarChart3 },
    { href: '/dashboard/sources', en: 'Data sources', zh: '数据源', icon: Cable },
    { href: '/dashboard/views/indie_hacker', en: 'Intelligence views', zh: '智能视图', icon: Layers3 },
  ] },
  { en: 'Agent', zh: 'Agent', icon: Bot, mobileHref: '/dashboard/agent', children: [
    { href: '/dashboard/agent', en: 'Agent settings', zh: 'Agent 设置', icon: Bot },
    { href: '/dashboard/tasks', en: 'Agent tasks', zh: 'Agent 任务', icon: Clock3 },
    { href: '/dashboard/actions', en: 'Actions', zh: '行动', icon: ListChecks },
    { href: '/dashboard/agent/radar', en: 'Signal radar', zh: '信号雷达', icon: RadioTower },
    { href: '/dashboard/missions', en: 'Growth missions', zh: '增长任务', icon: Rocket },
    { href: '/dashboard/marketplace', en: 'Skill marketplace', zh: 'Skill 市场', icon: Store },
  ] },
  { en: 'Reports', zh: '报告', icon: BarChart3, href: '/dashboard/reports' },
  { en: 'Settings', zh: '设置', icon: Settings, href: '/dashboard/settings' },
];

function matches(pathname: string, href: string, exact = false) {
  return exact || href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNavigation({ locale }: { locale: 'en' | 'zh' }) {
  const pathname = usePathname();
  const router = useRouter();
  const zh = locale === 'zh';
  return <nav className="dashboard-nav" aria-label={zh ? '后台导航' : 'Dashboard navigation'}>
    {groups.map((group) => {
      const active = group.href ? matches(pathname, group.href) : group.children?.some((item) => matches(pathname, item.href, item.exact)) || false;
      const Icon = group.icon;
      if (group.href) return <Link className="dashboard-nav-primary" aria-current={active ? 'page' : undefined} href={group.href} key={group.href}><Icon size={19} /><span>{zh ? group.zh : group.en}</span></Link>;
      return <details className="dashboard-nav-group" open={active || group.en === 'Product settings' || group.en === 'Data'} key={group.en}>
        <summary aria-current={active ? 'true' : undefined} onClick={(event) => { if (group.mobileHref && window.matchMedia('(max-width: 620px)').matches) { event.preventDefault(); router.push(group.mobileHref); } }}><Icon size={19} /><span>{zh ? group.zh : group.en}</span><ChevronDown className="nav-chevron" size={15} /></summary>
        <div>{group.children?.map((item) => { const ItemIcon = item.icon; const itemActive = matches(pathname, item.href, item.exact); return <Link aria-current={itemActive ? 'page' : undefined} href={item.href} key={item.href}><ItemIcon size={16} /><span>{zh ? item.zh : item.en}</span></Link>; })}</div>
      </details>;
    })}
  </nav>;
}
