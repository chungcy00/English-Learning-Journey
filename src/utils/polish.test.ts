import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('review reserve follows overlay height and cleans up observers', () => {
  const view = readFileSync(new URL('../views/ReviewView.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  assert.match(view, /ResizeObserver\(measure\)/);
  assert.match(view, /observer\?\.disconnect\(\)/);
  assert.match(view, /removeProperty\('--review-rating-height'\)/);
  assert.match(css, /padding-bottom: calc\(var\(--review-rating-height, 6rem\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('expression menu scroll follows keyboard navigation, not pointer movement', () => {
  const view = readFileSync(new URL('../components/ExpressionSelect.tsx', import.meta.url), 'utf8');
  assert.match(view, /open && keyboardNavigation.current/);
  assert.match(view, /keyboardNavigation.current = true/);
  assert.match(view, /onPointerMove=\{\(\) => \{ keyboardNavigation.current = false/);
});
