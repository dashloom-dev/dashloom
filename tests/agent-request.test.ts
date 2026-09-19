import assert from 'node:assert/strict';
import test from 'node:test';
import { agentAnalyzeInput, agentAnalyzeFormInput } from '../lib/agent-request.ts';

const productId = 'c0fdf810-a381-4c81-88b9-536a301c17b4';
const conversationId = 'e2699dd1-dc56-4c33-a827-5c3f748978a0';

test('new SEO conversation from multipart form accepts absent conversation ID', () => {
  const form = new FormData();
  form.set('question', 'GSC数据目前如何');
  form.set('preset', 'seo_growth_analyst');
  form.set('productId', productId);
  form.set('stream', 'true');
  const result = agentAnalyzeInput.parse(agentAnalyzeFormInput(form));
  assert.equal(result.conversationId, undefined);
  assert.equal(result.productId, productId);
  assert.equal(result.stream, true);
  assert.equal(result.preset, 'seo_growth_analyst');
});

test('multipart defaults match JSON defaults and empty optional fields are normalized', () => {
  const form = new FormData();
  form.set('question', 'Analyze portfolio');
  let result = agentAnalyzeInput.parse(agentAnalyzeFormInput(form));
  assert.equal(result.preset, 'portfolio_analyst');
  assert.equal(result.stream, undefined);
  assert.equal(result.conversationId, undefined);
  form.set('conversationId', '');
  form.set('productId', '');
  form.set('stream', 'false');
  result = agentAnalyzeInput.parse(agentAnalyzeFormInput(form));
  assert.equal(result.conversationId, undefined);
  assert.equal(result.productId, null);
  assert.equal(result.stream, false);
  assert.equal(agentAnalyzeInput.parse({ question: 'Analyze portfolio' }).preset, result.preset);
});

test('existing conversation ID is preserved and malformed IDs remain rejected', () => {
  const form = new FormData();
  form.set('question', 'Continue analysis');
  form.set('conversationId', conversationId);
  assert.equal(agentAnalyzeInput.parse(agentAnalyzeFormInput(form)).conversationId, conversationId);
  for (const invalid of ['bad-id', 'null', 'undefined']) {
    form.set('conversationId', invalid);
    assert.equal(agentAnalyzeInput.safeParse(agentAnalyzeFormInput(form)).success, false);
  }
});
