import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('learning card scrolling cleans up measurement observers and has no rating overlay', () => {
  const view = readFileSync(new URL('../components/PracticeVocabularyCard.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  assert.match(view, /ResizeObserver\(measure\)/);
  assert.match(view, /observer.disconnect\(\)/);
  assert.doesNotMatch(view + css, /review-rating-bar|review-rating-height/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('expression menu scroll follows keyboard navigation, not pointer movement', () => {
  const view = readFileSync(new URL('../components/ExpressionSelect.tsx', import.meta.url), 'utf8');
  assert.match(view, /open && keyboardNavigation.current/);
  assert.match(view, /keyboardNavigation.current = true/);
  assert.match(view, /onPointerMove=\{\(\) => \{ keyboardNavigation.current = false/);
});
