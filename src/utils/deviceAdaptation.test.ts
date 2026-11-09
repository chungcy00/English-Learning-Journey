import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { isSoftwareKeyboardVisible } from '../hooks/useSoftwareKeyboard';

test('keyboard detection requires editing and excludes zoom and browser chrome changes', () => {
  assert.equal(isSoftwareKeyboardVisible(800, 480, true, 1), true);
  assert.equal(isSoftwareKeyboardVisible(800, 730, true, 1), false);
  assert.equal(isSoftwareKeyboardVisible(800, 480, false, 1), false);
  assert.equal(isSoftwareKeyboardVisible(800, 480, true, 2), false);
});

test('adaptation retains zoom, safe areas, scrollable learning cards and minimum reading targets', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
  assert.match(css, /safe-area-inset-left/);
  assert.match(css, /\.software-keyboard-open \.installed-bottom-nav/);
  assert.doesNotMatch(css, /review-rating-bar/);
  assert.match(css, /\.review-page \.review-flip-inner \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.reading-vocabulary__term \{\s*min-height: 2.75rem/);
});
