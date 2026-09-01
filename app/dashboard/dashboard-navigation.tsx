'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  BarChart3, Bot, Boxes, Cable, ChartNoAxesCombined, ChevronDown, Clock3, Gauge,
  Layers3, LayoutDashboard, ListChecks, Plus, RadioTower, Rocket, Settings, Store, Target,
} from 'lucide-react';

type NavItem = { href: string; en: string; zh: string; icon: typeof LayoutDashboard; exact?: boolean };
type NavGroup = { en: string; zh: string; icon: typeof LayoutDashboard; href?: string; mobileHref?: string; children?: NavItem[] };

const groups: NavGroup[] = [
  { en: 'Overview', zh: '总览', icon: LayoutDashboard, href: '/dashboard' },
  { en: 'Products', zh: '产品', icon: Boxes, mobileHref: '/dashboard/products', children: [
    { href: '/dashboard/products/new', en: 'Add product', zh: '添加产品', icon: Plus, exact: true },
    { href: '/dashboard/products', en: 'All products', zh: '全部产品', icon: Boxes, exact: true },
    { href: '/dashboard/products/goals', en: 'Goals', zh: '目标', icon: Target, exact: true },
  ] },
  { en: 'Data', zh: '数据', icon: ChartNoAxesCombined, mobileHref: '/dashboard/data', children: [
    { href: '/dashboard/data', en: 'By product', zh: '按产品查看', icon: Gauge },
    { href: '/dashboard/charts', en: 'Charts', zh: '图表', icon: BarChart3 },
    { href: '/dashboard/sources', en: 'Data sources', zh: '数据源', icon: Cable },
    { href: '/dashboard/views/indie_hacker', en: 'Data dashboard', zh: '数据大盘', icon: Layers3 },
  ] },
  { en: 'AI reports', zh: 'AI 报告', icon: Bot, mobileHref: '/dashboard/agent', children: [
    { href: '/dashboard/agent', en: 'Create report', zh: '生成报告', icon: Bot },
    { href: '/dashboard/tasks', en: 'Report runs', zh: '运行记录', icon: Clock3 },
    { href: '/dashboard/actions', en: 'Open tasks', zh: '待办任务', icon: ListChecks },
    { href: '/dashboard/agent/radar', en: 'Notable changes', zh: '明显变化', icon: RadioTower },
    { href: '/dashboard/missions', en: 'Follow-ups', zh: '结果跟进', icon: Rocket },
    { href: '/dashboard/marketplace', en: 'AI extensions', zh: 'AI 扩展', icon: Store },
  ] },
  { en: 'Reports', zh: '报告', icon: BarChart3, href: '/dashboard/reports' },
  { en: 'Settings', zh: '设置', icon: Settings, href: '/dashboard/settings' },
];

function matches(pathname: string, href: string, exact = false) {
  return exact || href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationPending({ zh }: { zh: boolean }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <><i className="dashboard-nav-pending-dot" aria-hidden="true" /><span className="dashboard-navigation-progress" role="status"><i /><span className="sr-only">{zh ? '正在加载页面' : 'Loading page'}</span></span></>;
}

function NavigationLink({ href, className, current, zh, children }: { href: string; className?: string; current: boolean; zh: boolean; children: ReactNode }) {
  return <Link className={className} aria-current={current ? 'page' : undefined} href={href}>{children}<NavigationPending zh={zh} /></Link>;
}

export function DashboardNavigation({ locale }: { locale: 'en' | 'zh' }) {
  const pathname = usePathname();
  const router = useRouter();
  const zh = locale === 'zh';
  return <nav className="dashboard-nav" aria-label={zh ? '后台导航' : 'Dashboard navigation'}>
    {groups.map((group) => {
      const active = group.href ? matches(pathname, group.href) : group.children?.some((item) => matches(pathname, item.href, item.exact)) || false;
      const Icon = group.icon;
      if (group.href) return <NavigationLink className="dashboard-nav-primary" current={active} href={group.href} key={group.href} zh={zh}><Icon size={19} /><span>{zh ? group.zh : group.en}</span></NavigationLink>;
      return <details className="dashboard-nav-group" open={active || group.en === 'Products' || group.en === 'Data'} key={group.en}>
        <summary aria-current={active ? 'true' : undefined} onClick={(event) => { if (group.mobileHref && window.matchMedia('(max-width: 620px)').matches) { event.preventDefault(); router.push(group.mobileHref); } }}><Icon size={19} /><span>{zh ? group.zh : group.en}</span><ChevronDown className="nav-chevron" size={15} /></summary>
        <div>{group.children?.map((item) => { const ItemIcon = item.icon; const itemActive = matches(pathname, item.href, item.exact); return <NavigationLink current={itemActive} href={item.href} key={item.href} zh={zh}><ItemIcon size={16} /><span>{zh ? item.zh : item.en}</span></NavigationLink>; })}</div>
      </details>;
    })}
  </nav>;
}
