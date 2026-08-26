import assert from 'node:assert/strict';
import test from 'node:test';
import { agentScopeLabel, isAgentScopeReady, normalizeAgentProductScope, resolveAgentProductScope } from '../lib/agent-scope.ts';

test('new Agent conversations use the explicitly requested product scope', () => {
  assert.deepEqual(resolveAgentProductScope('product-one'), { mode: 'product', productId: 'product-one' });
  assert.deepEqual(resolveAgentProductScope(null), { mode: 'workspace', productId: null });
});

test('existing Agent conversations keep their original scope', () => {
  assert.deepEqual(resolveAgentProductScope('product-two', { mode: 'product', productId: 'product-one' }), { mode: 'product', productId: 'product-one' });
  assert.deepEqual(resolveAgentProductScope('product-two', { mode: 'workspace', productId: null }), { mode: 'workspace', productId: null });
});

test('persisted workspace scope cannot retain a contradictory product identifier', () => {
  assert.deepEqual(normalizeAgentProductScope({ mode: 'workspace', productId: 'unexpected-product' }), { mode: 'workspace', productId: null });
  assert.deepEqual(normalizeAgentProductScope({ mode: 'product', productId: 'product-one' }), { mode: 'product', productId: 'product-one' });
});

test('Agent scope labels never expose a missing product identifier', () => {
  const products = [{ id: 'product-one', name: 'Northstar' }];
  assert.equal(agentScopeLabel({ mode: 'workspace', productId: null }, products), 'All products');
  assert.equal(agentScopeLabel({ mode: 'product', productId: 'product-one' }, products), 'Northstar');
  assert.equal(agentScopeLabel({ mode: 'product', productId: null }, products), 'Removed product');
  assert.equal(agentScopeLabel({ mode: 'product', productId: 'deleted-product' }, products), 'Selected product');
});

test('Agent readiness follows both the selected scope and specialist', () => {
  const readiness = {
    workspace: { portfolio_analyst: true, revenue_analyst: false },
    'product-one': { portfolio_analyst: false, revenue_analyst: true },
  };
  assert.equal(isAgentScopeReady(readiness, null, 'portfolio_analyst'), true);
  assert.equal(isAgentScopeReady(readiness, null, 'revenue_analyst'), false);
  assert.equal(isAgentScopeReady(readiness, 'product-one', 'revenue_analyst'), true);
  assert.equal(isAgentScopeReady(readiness, 'product-one', 'seo_growth_analyst'), false);
  assert.equal(isAgentScopeReady(readiness, 'missing-product', 'portfolio_analyst'), false);
});
