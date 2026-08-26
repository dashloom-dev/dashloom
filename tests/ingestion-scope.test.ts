import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestionScopeAllowsProducts } from '../lib/ingestion-scope.ts';

test('workspace ingestion scope accepts one or many requested products', () => {
  assert.equal(ingestionScopeAllowsProducts(null, ['product-a']), true);
  assert.equal(ingestionScopeAllowsProducts(null, ['product-a', 'product-b']), true);
});

test('product ingestion scope accepts only its assigned product', () => {
  assert.equal(ingestionScopeAllowsProducts('product-a', ['product-a']), true);
  assert.equal(ingestionScopeAllowsProducts('product-a', ['product-b']), false);
  assert.equal(ingestionScopeAllowsProducts('product-a', ['product-a', 'product-b']), false);
});

test('ingestion scope rejects an empty product set', () => {
  assert.equal(ingestionScopeAllowsProducts(null, []), false);
  assert.equal(ingestionScopeAllowsProducts('product-a', []), false);
});
