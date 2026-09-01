import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { translateDashboard } from '../app/dashboard/dashboard-translations.ts';

test('Cloudflare-compatible provider validation rejects redirects manually', () => {
  const safeUrl = readFileSync(new URL('../lib/safe-url.ts', import.meta.url), 'utf8');
  const providerRoute = readFileSync(new URL('../app/api/ai/providers/route.ts', import.meta.url), 'utf8');
  const adapter = readFileSync(new URL('../lib/openai-compatible.ts', import.meta.url), 'utf8');
  const agent = readFileSync(new URL('../lib/agent.ts', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../app/dashboard/settings/provider-form.tsx', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../drizzle/0001_sparkling_vivisector.sql', import.meta.url), 'utf8');

  assert.doesNotMatch(safeUrl, /redirect:\s*['"]error['"]/);
  assert.match(safeUrl, /redirect:\s*['"]manual['"]/);
  assert.match(adapter, /redirect:\s*['"]manual['"]/);
  assert.match(adapter, /response\.status >= 300 && response\.status < 400/);
  assert.match(adapter, /\/chat\/completions/);
  assert.match(providerRoute, /detectOpenAiCompatibility/);
  assert.match(providerRoute, /compatibilityJson/);
  assert.match(providerRoute, /pathname\.endsWith\('\/chat\/completions'\)/);
  assert.match(agent, /parseProviderCompatibility/);
  assert.match(agent, /invokeOpenAiCompatible/);
  assert.doesNotMatch(agent, /createOpenAI|generateText/);
  assert.match(agent, /Math\.ceil\(\(system\.length \+ prompt\.length\) \/ 4\)/);
  assert.match(form, /compatibilityMode/);
  assert.match(form, /Auto detect \(recommended\)/);
  assert.match(migration, /ADD `compatibility_json`/);
});

test('AI provider connection results have actionable Chinese translations', () => {
  assert.equal(translateDashboard('Provider connected.'), '服务商连接成功。');
  assert.equal(
    translateDashboard('Provider could not be reached during validation.'),
    '验证时无法连接服务商，请检查 API 地址、网络和服务状态。',
  );
  assert.equal(
    translateDashboard('Provider returned HTTP 401 while validating.'),
    '服务商验证接口返回 HTTP 401，请检查 API 地址、密钥和模型服务状态。',
  );
  assert.equal(
    translateDashboard('Provider validation refused a redirect. Use the final API base URL.'),
    '验证接口返回了重定向。请填写最终的 API 基础地址。',
  );
});
