import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const css = readFileSync(new URL('index.css', root), 'utf8');

test('learning typography preserves font identity, tabular metadata and browser zoom', () => {
  assert.match(css, /--font-app: "Inter", "Noto Sans SC"/);
  assert.match(css, /--font-editorial: "Cormorant Garamond"/);
  assert.match(css, /\.type-meta[^}]+tabular-nums/);
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /display=swap/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
});

test('compact mobile type keeps words readable without shrinking touch targets or inputs', () => {
  assert.match(css, /#word-detail-title \{ font-size: var\(--type-term\)/);
  assert.match(css, /main textarea \{ font-size: var\(--type-example\); line-height: 1\.6/);
  assert.match(css, /\.reading-vocabulary__term \{\s*min-height: 2\.75rem/);
});

test('repeated teaching content shares type roles across reading, wordbook and review', () => {
  for (const name of ['ReadingView', 'WordbookView', 'ReviewView']) {
    const source = readFileSync(new URL(`../views/${name}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /type-body/);
  }
  const details = readFileSync(new URL('../components/WordDetailModal.tsx', import.meta.url), 'utf8');
  assert.match(details, /type-example/);
  assert.match(details, /type-translation/);
  const select = readFileSync(new URL('../components/ExpressionSelect.tsx', import.meta.url), 'utf8');
  assert.match(select, /type-label italic/);
});

test('typography uses the requested mobile-first scale and one desktop breakpoint', () => {
  const sizes = { page: '1.5rem', section: '1.25rem', term: '1rem', reading: '1.0625rem', example: '1rem', body: '0.9375rem', translation: '0.9375rem', label: '0.8125rem', meta: '0.75rem' };
  for (const [role, size] of Object.entries(sizes)) {
    assert.equal(css.match(new RegExp(`--type-${role}: ([^;]+);`))?.[1], size);
  }
  assert.match(css, /@media \(min-width: 640px\)\s*\{\s*:root \{ --type-page: 1\.875rem; --type-section: 1\.5rem; --type-term: 1\.1875rem; --type-reading: 1\.15rem; \}/);
  assert.doesNotMatch(css, /font-size:\s*(?!var\(--type-)[\d.]/);
  assert.match(css, /\.type-reading[^}]*line-height: 1\.7;/);
  assert.match(css, /\.type-translation[^}]*font-size: var\(--type-translation\);[^}]*line-height: 1\.6;/);
});

test('application components do not bypass typography tokens with literal size utilities', () => {
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.tsx')) {
        const source = readFileSync(file, 'utf8');
        assert.doesNotMatch(source, /\btext-(?:xs|sm|base|lg|xl|[2-9]xl|\[\d)/, file);
        assert.doesNotMatch(source, /fontSize\s*:/, file);
      }
    }
  };
  visit(root.pathname);
});
