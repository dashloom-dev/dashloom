import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootLayout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const feedback = readFileSync(new URL('../app/instant-interaction-feedback.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('root layout mounts the site-wide interaction feedback layer', () => {
  assert.match(rootLayout, /<InstantInteractionFeedback\s*\/>/);
  assert.match(rootLayout, /<Suspense fallback=\{null\}>/);
});

test('site-wide feedback covers navigation, action, pointer, and keyboard paths', () => {
  assert.match(feedback, /document\.addEventListener\('pointerdown'/);
  assert.match(feedback, /document\.addEventListener\('click'/);
  assert.match(feedback, /document\.addEventListener\('submit'/);
  assert.doesNotMatch(feedback, /router\.prefetch\(destination\)/);
  assert.match(feedback, /window\.location\.assign\(destination\)/);
  assert.match(feedback, /data-active=\{navigating/);
});

test('site-wide feedback includes immediate and reduced-motion visual states', () => {
  assert.match(styles, /\[data-instant-pressed='true'\]/);
  assert.match(styles, /\[data-instant-action='pending'\]/);
  assert.match(styles, /\.instant-navigation-progress/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});
