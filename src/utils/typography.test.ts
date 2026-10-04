import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
test('learning typography preserves font identity and uses scalable roles', () => {
  assert.match(css, /--font-app: "Inter", "Noto Sans SC"/);
  assert.match(css, /--font-editorial: "Cormorant Garamond"/);
  assert.match(css, /--type-body: 1rem/);
  assert.match(css, /--type-reading: 1\.25rem/);
  assert.match(css, /--type-example: 1\.25rem/);
  assert.match(css, /\.type-translation[^}]+line-height: 1\.85/);
  assert.match(css, /\.type-meta[^}]+tabular-nums/);
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /display=swap/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
});

test('repeated teaching content shares type roles across reading, wordbook and review', () => {
  for (const name of ['ReadingView', 'WordbookView', 'ReviewView']) {
    const source = readFileSync(new URL(`../views/${name}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /type-body/);
  }
  const details = readFileSync(new URL('../components/WordDetailModal.tsx', import.meta.url), 'utf8');
  assert.match(details, /type-example/);
  assert.match(details, /type-body/);
  const select = readFileSync(new URL('../components/ExpressionSelect.tsx', import.meta.url), 'utf8');
  assert.match(select, /type-label italic/);
});
