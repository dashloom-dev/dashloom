import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { translateDashboard } from '../app/dashboard/dashboard-translations.ts';

test('Chinese dashboard coverage includes critical settings, sources, radar, and marketplace copy', () => {
  const critical = [
    'Review before sharing',
    'Describe the goal, what you expected, and what you observed.',
    'Include anonymous workspace diagnostics',
    'Connection name',
    'Environment',
    'Import metrics',
    'Needs attention',
    'COMPLETE COMPARISON WINDOWS',
    'Connect a real product to activate Signal Radar.',
    'Trust must be verified',
    'Available',
    'Installed',
  ];
  for (const source of critical) assert.notEqual(translateDashboard(source), source, `missing Chinese translation: ${source}`);
});

test('Chinese intelligence views cover templates, metrics, actions, and empty states', () => {
  const intelligenceViewCopy = [
    'INDIE HACKER DASHBOARD', 'Portfolio command center',
    'Compare product traction, revenue, delivery, and infrastructure signals without opening five separate tools.',
    'Portfolio Analyst', 'Active Users', 'Requests', 'Clicks', 'Repo Stars', 'Repo Commits',
    'No comparable prior evidence', 'EVIDENCE TABLE', 'Product and metric movement',
    'This view has no matching evidence yet. Connect a source or import metrics with the names shown above.',
  ];
  for (const source of intelligenceViewCopy) assert.notEqual(translateDashboard(source), source, `missing Chinese intelligence-view translation: ${source}`);
  const page = readFileSync(new URL('../app/dashboard/views/[preset]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /getDeploymentLocale/);
  assert.match(page, /t\(definition\.title\)/);
  assert.match(page, /humanize\(metric, locale\)/);
  assert.match(page, /未设置币种/);
});

test('community deployment uses one deployment locale without localized dashboard routes', () => {
  const layout = readFileSync(new URL('../app/dashboard/layout.tsx', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../app/dashboard/views/[preset]/page.tsx', import.meta.url), 'utf8');
  const account = readFileSync(new URL('../app/dashboard/dashboard-account-menu.tsx', import.meta.url), 'utf8');
  assert.match(layout, /getDeploymentLocale\(\)/);
  assert.match(view, /getDeploymentLocale\(\)/);
  assert.doesNotMatch(layout, /\/zh\/dashboard/);
  assert.doesNotMatch(account, /<select/);
  assert.match(account, /github\.com\/dashloom-dev\/dashloom#readme/);
  assert.equal(existsSync(new URL('../app/docs/page.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../proxy.ts', import.meta.url)), false);
});

test('dynamic dashboard status copy is localized', () => {
  assert.equal(translateDashboard('0 real products · latest not synced'), '0 个真实产品 · 最近尚未同步');
});

test('Chinese settings views do not fall back to mixed English UI copy', () => {
  const settingsCopy = [
    'Weekly founder view', 'Indie Hacker', 'Founder weekly pulse', 'revenue, active_users, clicks',
    'The signals this view should emphasize', 'Use as default for this template',
    'Use normalized metric names separated by commas. A view can include up to eight metrics and remains isolated to this workspace.',
    'Create view', 'reusable dashboard views',
    'No saved views yet. The five built-in templates remain available in navigation.',
    'Stored encrypted; never displayed again', 'Cancellation policy',
  ];
  for (const source of settingsCopy) assert.notEqual(translateDashboard(source), source, `missing Chinese settings translation: ${source}`);
  assert.equal(translateDashboard('Create view'), '创建视图');
  assert.equal(translateDashboard('Create unknown object'), 'Create unknown object', 'generic rules must not produce mixed-language labels');
});
