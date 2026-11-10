import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('learning cards use page scrolling without a height cap or rating overlay', () => {
  const view = readFileSync(new URL('../components/PracticeVocabularyCard.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  assert.doesNotMatch(view, /ResizeObserver|review-card-limit/);
  assert.match(css, /\.review-page \.practice-vocabulary-card__body \{ overflow: visible; overscroll-behavior: auto; touch-action: auto/);
  assert.doesNotMatch(view + css, /review-rating-bar|review-rating-height/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('expression menu scroll follows keyboard navigation, not pointer movement', () => {
  const view = readFileSync(new URL('../components/ExpressionSelect.tsx', import.meta.url), 'utf8');
  assert.match(view, /if \(!open \|\| !keyboardNavigation.current\) return/);
  assert.match(view, /menu.scrollTop =/);
  assert.doesNotMatch(view, /scrollIntoView/);
  assert.match(view, /keyboardNavigation.current = true/);
  assert.match(view, /onPointerMove=\{\(\) => \{ keyboardNavigation.current = false/);
});
