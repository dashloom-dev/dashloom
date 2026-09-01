import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentOutputFormatError, parseAgentOutputJson } from '../lib/agent-output.ts';
import { translateDashboard } from '../app/dashboard/dashboard-translations.ts';

test('agent output parser accepts plain, fenced, and surrounding JSON', () => {
  assert.deepEqual(parseAgentOutputJson('{"summary":"ok","findings":[]}'), { summary: 'ok', findings: [] });
  assert.deepEqual(parseAgentOutputJson('```json\n{"summary":"ok","findings":[]}\n```'), { summary: 'ok', findings: [] });
  assert.deepEqual(parseAgentOutputJson('Here is the result:\n{"summary":"ok","findings":[]}\nDone.'), { summary: 'ok', findings: [] });
});

test('agent output parser replaces raw JSON errors with actionable provider errors', () => {
  assert.throws(() => parseAgentOutputJson(''), (error) => error instanceof AgentOutputFormatError && error.code === 'PROVIDER_OUTPUT_INVALID' && /empty response/.test(error.message));
  assert.throws(() => parseAgentOutputJson('{"summary":"cut off"'), (error) => error instanceof AgentOutputFormatError && error.code === 'PROVIDER_OUTPUT_INVALID' && /incomplete or invalid JSON/.test(error.message));
});

test('agent provider output errors have actionable Chinese translations', () => {
  assert.equal(translateDashboard('The AI provider returned an empty response. Try again; if this continues, verify the configured model and API base URL.'), 'AI 服务商返回了空响应，请重试；如果持续出现，请检查配置的模型和 API 基础地址。');
  assert.equal(translateDashboard('The AI provider returned incomplete or invalid JSON. Try again; if this continues, verify the model supports the configured output limit.'), 'AI 服务商返回了不完整或无效的 JSON，请重试；如果持续出现，请确认模型支持当前输出长度限制。');
});
