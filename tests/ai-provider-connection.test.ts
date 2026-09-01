import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { translateDashboard } from '../app/dashboard/dashboard-translations.ts';

test('Cloudflare-compatible provider validation rejects redirects manually', () => {
  const safeUrl = readFileSync(new URL('../lib/safe-url.ts', import.meta.url), 'utf8');
  const providerRoute = readFileSync(new URL('../app/api/ai/providers/route.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(safeUrl, /redirect:\s*['"]error['"]/);
  assert.match(safeUrl, /redirect:\s*['"]manual['"]/);
  assert.match(providerRoute, /redirect:\s*['"]manual['"]/);
  assert.match(providerRoute, /response\.status >= 300 && response\.status < 400/);
  assert.match(providerRoute, /api\.kie\.ai/);
  assert.match(providerRoute, /\/api\/v1\/chat\/credit/);
  assert.match(providerRoute, /pathname\.endsWith\('\/chat\/completions'\)/);
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
