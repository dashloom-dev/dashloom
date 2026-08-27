import assert from 'node:assert/strict';
import test from 'node:test';
import { localeLanguageTag, parseDeploymentLocale } from '../lib/deployment-locale-value.ts';

test('deployment locale defaults to English and accepts documented values', () => {
  assert.equal(parseDeploymentLocale(), 'en');
  assert.equal(parseDeploymentLocale('en'), 'en');
  assert.equal(parseDeploymentLocale('zh-CN'), 'zh');
});

test('deployment locale normalizes internal aliases and rejects unsupported values', () => {
  assert.equal(parseDeploymentLocale('EN-us'), 'en');
  assert.equal(parseDeploymentLocale('zh'), 'zh');
  assert.equal(localeLanguageTag(parseDeploymentLocale('zh-CN')), 'zh-CN');
  assert.throws(() => parseDeploymentLocale('fr'), /must be en or zh-CN/);
});
