import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const css = readFileSync(new URL('index.css', root), 'utf8');

test('learning typography prioritizes bundled Latin and Chinese faces, tabular metadata and browser zoom', () => {
  assert.match(css, /--font-app: "Nunito Variable", "Noto Sans TC Variable", "PingFang SC", "Microsoft YaHei", sans-serif/);
  for (const asset of ['nunito/wght.css', 'nunito/wght-italic.css', 'noto-sans-tc/wght.css']) {
    assert.ok(css.includes(`@fontsource-variable/${asset}`));
  }
  assert.match(css, /font-synthesis: none/);
  assert.match(css, /--font-editorial: var\(--font-app\)/);
  assert.doesNotMatch(css, /Cormorant|Georgia/);
  assert.match(css, /\.type-meta[^}]+tabular-nums/);
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /fonts.googleapis.com|fonts.gstatic.com/);
  assert.doesNotMatch(html, /Cormorant/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
});

test('bundled variable fonts preserve real weights, digit coverage and shipped licenses', () => {
  for (const [family, weightRange] of [['nunito', '200 1000'], ['noto-sans-tc', '100 900']]) {
    const fontCss = readFileSync(new URL(`../../node_modules/@fontsource-variable/${family}/wght.css`, import.meta.url), 'utf8');
    assert.ok(fontCss.includes(`font-weight: ${weightRange};`));
    assert.ok(fontCss.includes('font-display: swap;'));
  }
  for (const license of ['Nunito-OFL.txt', 'Noto-Sans-TC-OFL.txt']) {
    const text = readFileSync(new URL(`../../public/fonts/licenses/${license}`, import.meta.url), 'utf8');
    assert.match(text, /SIL OPEN FONT LICENSE/);
  }
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
  const sizes = { page: '1.5rem', section: '1.125rem', term: '1rem', reading: '0.9375rem', example: '1rem', body: '0.9375rem', translation: '0.875rem', label: '0.75rem', meta: '0.75rem' };
  for (const [role, size] of Object.entries(sizes)) {
    assert.equal(css.match(new RegExp(`--type-${role}: ([^;]+);`))?.[1], size);
  }
  assert.match(css, /@media \(min-width: 640px\)\s*\{\s*:root \{ --type-page: 1\.75rem; --type-section: 1\.25rem; \}/);
  assert.doesNotMatch(css, /--type-review-term|--type-wordbook-entry/);
  assert.match(css, /\.type-page[^}]*font-weight: 700/);
  assert.match(css, /\.type-term[^}]*font-weight: 500/);
  assert.match(css, /--text-ink: #2C3E35/);
  assert.doesNotMatch(css, /font-size:\s*(?!var\(--type-)[\d.]/);
  assert.match(css, /\.type-reading[^}]*line-height: var\(--type-reading-leading\);/);
  assert.match(css, /--type-reading-leading: 1\.65;/);
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
