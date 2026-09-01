import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentOutputFormatError, normalizeAgentConfidence, normalizeAgentFindingInput, normalizeAgentNumber, normalizeAgentResultInput, normalizeAgentSeverity, parseAgentOutputJson } from '../lib/agent-output.ts';
import { translateDashboard } from '../app/dashboard/dashboard-translations.ts';

test('agent output parser accepts plain, fenced, and surrounding JSON', () => {
  assert.deepEqual(parseAgentOutputJson('{"summary":"ok","findings":[]}'), { summary: 'ok', findings: [] });
  assert.deepEqual(parseAgentOutputJson('```json\n{"summary":"ok","findings":[]}\n```'), { summary: 'ok', findings: [] });
  assert.deepEqual(parseAgentOutputJson('Here is the result:\n{"summary":"ok","findings":[]}\nDone.'), { summary: 'ok', findings: [] });
  assert.deepEqual(parseAgentOutputJson(JSON.stringify('```json\n{"summary":"ok","findings":[]}\n```')), { summary: 'ok', findings: [] });
});

test('agent output parser replaces raw JSON errors with actionable provider errors', () => {
  assert.throws(() => parseAgentOutputJson(''), (error) => error instanceof AgentOutputFormatError && error.code === 'PROVIDER_OUTPUT_INVALID' && /empty response/.test(error.message));
  assert.throws(() => parseAgentOutputJson('{"summary":"cut off"'), (error) => error instanceof AgentOutputFormatError && error.code === 'PROVIDER_OUTPUT_INVALID' && /incomplete or invalid JSON/.test(error.message));
});

test('agent result severity normalizes common provider labels', () => {
  assert.equal(normalizeAgentSeverity('high'), 'critical');
  assert.equal(normalizeAgentSeverity('MEDIUM'), 'warning');
  assert.equal(normalizeAgentSeverity(' low '), 'info');
  assert.equal(normalizeAgentSeverity('critical'), 'critical');
});

test('agent result input normalizes common OpenAI-compatible field variants locally', () => {
  assert.equal(normalizeAgentNumber('68,936'), 68936);
  assert.equal(normalizeAgentNumber('-54.49%'), -54.49);
  assert.equal(normalizeAgentConfidence('90'), 0.9);
  assert.deepEqual(normalizeAgentFindingInput({ title: 'Traffic declined', description: 'Sessions fell.', priority: 'high', product_id: 'product-1', current_value: '50,152', previous_value: 76708, change_percent: '-34.62%', recommendation: 'Investigate.', confidence: '90', citations: ['metric:one'] }), {
    title: 'Traffic declined', description: 'Sessions fell.', priority: 'high', product_id: 'product-1', current_value: '50,152', previous_value: 76708, change_percent: '-34.62%', recommendation: 'Investigate.', confidence: '90', citations: ['metric:one'],
    detail: 'Sessions fell.', severity: 'high', metric: null, productId: 'product-1', currentValue: '50,152', previousValue: 76708, changePercent: '-34.62%', action: 'Investigate.', evidenceRefs: ['metric:one'],
  });
  assert.deepEqual(normalizeAgentResultInput({ overview: 'Summary', insights: [{ title: 'One' }] }), { overview: 'Summary', insights: [{ title: 'One' }], summary: 'Summary', findings: [{ title: 'One' }] });
});

test('agent provider output errors have actionable Chinese translations', () => {
  assert.equal(
    translateDashboard('The AI provider returned an empty response. Try again; if this continues, verify the configured model and API base URL.'),
    'AI 服务商返回了空响应，请重试；如果持续出现，请检查配置的模型和 API 基础地址。',
  );
  assert.equal(
    translateDashboard('The AI provider returned incomplete or invalid JSON. Try again; if this continues, verify the model supports the configured output limit.'),
    'AI 服务商返回了不完整或无效的 JSON，请重试；如果持续出现，请确认模型支持当前输出长度限制。',
  );
  assert.equal(
    translateDashboard('The AI provider returned JSON that did not match the required Agent result structure. Try again.'),
    'AI 服务商返回的 JSON 不符合 Agent 结果结构，请重试。',
  );
  assert.equal(
    translateDashboard('The AI provider returned findings that did not match the supplied evidence. Try again.'),
    'AI 服务商返回的分析结果与本轮证据不匹配，请重试。',
  );
});
