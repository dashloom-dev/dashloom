import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('infrastructure evidence sources remain visible and separately authorized', () => {
  const sources = read('app/dashboard/sources/page.tsx');
  for (const connector of ['CloudflareForm', 'CloudflareR2Form', 'CloudflarePagesForm', 'CloudflareQueuesForm', 'GitHubForm', 'VercelForm']) {
    assert.match(sources, new RegExp(`<${connector}\\b`));
  }
  assert.match(sources, /Infrastructure & delivery/);
  assert.match(sources, /基础设施与交付/);
  assert.match(sources, /every connector requires separate read-only authorization/);
});

test('the compatibility preset has a multi-source outward name', () => {
  const templates = read('lib/dashboard-templates.ts');
  const layout = read('app/dashboard/layout.tsx');
  assert.match(templates, /cloudflare_operations: \{ eyebrow: 'INFRASTRUCTURE OPERATIONS'/);
  assert.match(layout, /'Infrastructure Ops', '基础设施运维'/);
});

test('both GitHub README languages document infrastructure connectors and deployment locale', () => {
  const english = read('README.md');
  const chinese = read('README.zh-CN.md');
  for (const value of ['Cloudflare Workers/R2/Pages/Queues', 'GitHub', 'Vercel']) {
    assert.ok(english.includes(value));
    assert.ok(chinese.includes(value));
  }
  assert.match(english, /deployment-wide interface locale/);
  assert.match(chinese, /部署级语言/);
});

test('deployment guides describe one deployment-wide locale without workspace switching', () => {
  const guides = [
    read('docs/deployment-cloudflare.md'),
    read('docs/deployment-cloudflare.zh-CN.md'),
    read('docs/deployment-next.md'),
    read('docs/deployment-next.zh-CN.md'),
  ];
  for (const guide of guides) {
    assert.doesNotMatch(guide, /Workspace owners can change|workspace language switching|工作空间 Owner 之后仍可切换|工作空间语言切换/);
    assert.match(guide, /whole Community deployment|整个 Community 部署/);
  }
});
