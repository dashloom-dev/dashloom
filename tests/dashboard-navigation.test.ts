import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('community dashboard uses grouped route-aware navigation without cloud-only destinations', () => {
  const navigation = readFileSync(new URL('../app/dashboard/dashboard-navigation.tsx', import.meta.url), 'utf8');
  assert.match(navigation, /usePathname/);
  assert.match(navigation, /<details className="dashboard-nav-group"/);
  assert.match(navigation, /current=\{itemActive\}/);
  assert.match(navigation, /useLinkStatus/);
  assert.doesNotMatch(navigation, /prefetch=\{prefetch\}/);
  assert.match(navigation, /window\.matchMedia\('\(max-width: 620px\)'\)/);
  assert.match(navigation, /\/dashboard\/products\/new/);
  assert.match(navigation, /\/dashboard\/products\/goals/);
  assert.match(navigation, /\/dashboard\/data/);
  assert.match(navigation, /\/dashboard\/charts/);
  assert.doesNotMatch(navigation, /\/dashboard\/(upgrade|credits|agency)/);
});

test('product settings and data navigation destinations exist as independent routes', () => {
  for (const path of [
    '../app/dashboard/products/new/page.tsx',
    '../app/dashboard/products/goals/page.tsx',
    '../app/dashboard/data/page.tsx',
    '../app/dashboard/data/[productId]/page.tsx',
    '../app/dashboard/charts/page.tsx',
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), true, `missing route: ${path}`);
});

test('data dashboard is the first Data destination and the mobile shortcut', () => {
  const navigation = readFileSync(new URL('../app/dashboard/dashboard-navigation.tsx', import.meta.url), 'utf8');
  const dataGroup = navigation.slice(navigation.indexOf("{ en: 'Data'"), navigation.indexOf("{ en: 'AI reports'"));
  assert.match(dataGroup, /mobileHref: '\/dashboard\/views\/indie_hacker'/);
  assert.ok(dataGroup.indexOf("{ href: '/dashboard/views/indie_hacker'") < dataGroup.indexOf("{ href: '/dashboard/data'"));
});

test('community navigation keeps deployment locale and open-source documentation behavior', () => {
  const layout = readFileSync(new URL('../app/dashboard/layout.tsx', import.meta.url), 'utf8');
  const account = readFileSync(new URL('../app/dashboard/dashboard-account-menu.tsx', import.meta.url), 'utf8');
  assert.match(layout, /getDeploymentLocale\(\)/);
  assert.match(account, /github\.com\/dashloom-dev\/dashloom#readme/);
  assert.doesNotMatch(layout, /localizeDashboardPath|workspaceBranding|\/dashboard\/upgrade/);
});
