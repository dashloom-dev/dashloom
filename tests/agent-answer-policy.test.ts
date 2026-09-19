import assert from 'node:assert/strict';
import test from 'node:test';
import { answerLanguage, balancedEvidence, coverageDisclosure, loadProductEvidence, observedChange, productCoverage, validateAnswerLanguage, validatePortfolioCoverage } from '../lib/agent-answer-policy.ts';
import { buildAgentRepairRequest } from '../lib/agent-repair.ts';

test('missing current samples cannot become a 100 percent decline', () => {
  assert.equal(observedChange(0, 100, 0, 7), null);
  assert.equal(observedChange(0, 100, 7, 7), -100);
  assert.equal(observedChange(50, 100, 7, 7), -50);
  assert.equal(observedChange(100, 0, 7, 0), null);
});

test('Chinese questions and explicit language overrides control answer and repair language', () => {
  assert.equal(answerLanguage('本周我的产品组合发生了什么变化？'), 'zh');
  assert.equal(answerLanguage('请用英文分析产品'), 'en');
  assert.equal(answerLanguage('Please answer in Chinese'), 'zh');
  assert.throws(() => validateAnswerLanguage({ summary: 'This week', findings: [] }, 'zh'), /language mismatch/);
  assert.doesNotThrow(() => validateAnswerLanguage({ summary: '本周整体变化', findings: [{ title: 'GSC 点击下降', detail: '数据覆盖有限', action: '核对原始证据' }] }, 'zh'));
  const repair = JSON.parse(buildAgentRepairRequest({ draft: '{}', evidenceIds: [], productIds: [], language: 'zh', truncated: { metrics: true } }).prompt);
  assert.equal(repair.responseLanguage, 'zh');
  assert.ok(repair.rules.some((rule: string) => rule.includes('证据覆盖不完整')));
  assert.ok(!repair.rules.some((rule: string) => rule.includes('Evidence coverage is incomplete')));
});

test('26-product evidence selection does not let one high-volume product dominate', () => {
  const products = Array.from({ length: 26 }, (_, i) => ({ id: String(i), name: `Product-${i}` }));
  const series = products.flatMap((product, i) => Array.from({ length: i === 0 ? 200 : 2 }, (_, n) => ({ productId: product.id, evidenceId: `${product.id}:${n}`, currentSamples: 7, previousSamples: 7 })));
  const selected = balancedEvidence(series, 40, (item) => item.productId);
  assert.equal(new Set(selected.map((item) => item.productId)).size, 26);
  const coverage = productCoverage(products, series);
  assert.throws(() => validatePortfolioCoverage({ findings: [{ evidenceRefs: ['0:0'] }] }, coverage, '本周产品组合有什么变化？'), /Portfolio coverage mismatch/);
  assert.doesNotThrow(() => validatePortfolioCoverage({ findings: [{ evidenceRefs: ['0:0', '1:0', '2:0'] }] }, coverage, '本周产品组合有什么变化？'));
  assert.doesNotThrow(() => validatePortfolioCoverage({ findings: [{ evidenceRefs: ['0:0'] }] }, coverage, '只分析 Product-0'));
  assert.doesNotThrow(() => validatePortfolioCoverage({ findings: [{ evidenceRefs: ['0:0'] }] }, coverage, '解释上一条的第一个建议'));
});

test('coverage distinguishes comparable, one-period, missing and omitted products', () => {
  const coverage = productCoverage(['a', 'b', 'c', 'd'].map((id) => ({ id, name: id })), [
    { productId: 'a', evidenceId: 'a:1', currentSamples: 7, previousSamples: 7 },
    { productId: 'b', evidenceId: 'b:1', currentSamples: 7, previousSamples: 0 },
  ], ['d']);
  assert.deepEqual(coverage.map((item) => item.status), ['comparable', 'partial', 'no_data', 'limited']);
  assert.match(coverageDisclosure(coverage, 'zh'), /全部 4 个产品；其中 1 个/);
  assert.match(coverageDisclosure(coverage, 'zh'), /不能据此判断这些产品没有变化/);
});

test('data budget is redistributed and never exposes truncated period totals', async () => {
  const data: Record<string, number[]> = { large: Array.from({ length: 8 }, (_, i) => i), small: [10], empty: [] };
  const full = await loadProductEvidence(Object.keys(data), 10, async (id, limit) => data[id].slice(0, limit));
  assert.equal(full.rows.length, 9);
  assert.deepEqual(full.omittedProducts, []);
  const limited = await loadProductEvidence(Object.keys(data), 5, async (id, limit) => data[id].slice(0, limit));
  assert.deepEqual(limited.rows, [10]);
  assert.deepEqual(limited.omittedProducts, ['large']);
});
