import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Navbar } from '../components/Navbar';
import { InstalledAppBottomNav } from '../components/InstalledAppBottomNav';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('motion roles use one short timing system and avoid layout transitions', () => {
  assert.match(css, /--motion-feedback: 150ms/);
  assert.match(css, /--motion-form: 160ms/);
  assert.match(css, /--motion-overlay: 200ms/);
  for (const [, properties] of css.matchAll(/transition:\s*([^;]+);/g)) {
    assert.doesNotMatch(properties, /(?:^|,)\s*(?:all|width|height|top|left|margin|padding)\b/);
  }
});

test('vocabulary feedback uses sage tint and does not move words', () => {
  assert.match(css, /var\(--accent-secondary\) 12%, transparent/);
  assert.match(css, /var\(--accent-secondary\) 25%, transparent/);
  assert.match(css, /\.vocab-highlight:enabled:is\(:hover, :focus-visible, :active\)/);
});

test('dialogs, disabled controls and reduced motion do not depend on animation completion', () => {
  assert.match(css, /\.app-dialog\[open\], \.motion-modal-panel/);
  assert.match(css, /\.app-dialog::backdrop, \.motion-modal-overlay/);
  assert.match(css, /backdrop-filter: blur\(2px\)/);
  assert.match(css, /button:disabled:is\(:hover, :active\)[^}]*transform: none/);
  assert.match(css, /animation-duration: 0\.01ms !important/);
  assert.match(css, /transition-duration: 0\.01ms !important/);
  assert.match(css, /scroll-behavior: auto !important/);
  assert.match(css, /\.review-flip-inner, \.review-flip-inner.is-revealed, \.review-flip-back \{ transform: none/);
  assert.match(css, /\.animate-spin, \.animate-pulse \{ animation: none/);
});

test('navigation keeps its original flat containers, local active indicator and disabled semantics', () => {
  const installed = renderToStaticMarkup(React.createElement(InstalledAppBottomNav, {
    activeTab: 'rewrite', setActiveTab: () => {}, reviewCount: 7, hasCurrentReading: false,
  }));
  const browser = renderToStaticMarkup(React.createElement(Navbar, {
    activeTab: 'wordbook', setActiveTab: () => {}, reviewCount: 7, hasCurrentReading: false, }));
  for (const html of [installed, browser]) {
    assert.match(html, /aria-current="page"/);
    assert.match(html, /disabled=""/);
    assert.match(html, /7 个词条/);
  }
  const installedContainer = installed.match(/<nav[^>]+class="([^"]+)"/)![1];
  assert.match(installedContainer, /fixed inset-x-0 bottom-0/);
  assert.match(installedContainer, /border-t /);
  assert.doesNotMatch(installedContainer, /rounded|outline|ring-|(?:^|\s)border(?:\s|$)/);
  assert.match(installed, /safe-area-inset-bottom/);
  assert.match(installed, /<span class="relative flex h-7[^>]+bg-\[var\(--surface-selected\)\]/);
  const currentInstalledButton = installed.match(/<button[^>]+aria-current="page"[^>]*>/)![0];
  assert.doesNotMatch(currentInstalledButton, /bg-\[var\(--surface-selected\)\]/);
  assert.match(browser, /<header[^>]+border-b /);
  assert.match(css, /\.app-header nav \{\s*position: static;/);
  assert.doesNotMatch(css, /\.installed-bottom-nav button\[aria-current="page"\]/);
});

test('navigation has color-only feedback and source utilities never animate all properties', () => {
  assert.match(css, /\.installed-bottom-nav button > \* \{\s*transition: color var\(--motion-feedback\)/);
  const nav = readFileSync(new URL('../components/Navbar.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(nav, /transition-all/);
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /!isBottomNavApp && \(\s*<Navbar/);
  assert.match(app, /isBottomNavApp && \(\s*<InstalledAppBottomNav/);
});

test('exit presence reuses form timing, respects reduced motion, and keeps closing surfaces inert', () => {
  const hook = readFileSync(new URL('../hooks/useMotionPresence.ts', import.meta.url), 'utf8');
  assert.match(hook, /prefers-reduced-motion: reduce/);
  assert.match(hook, /--motion-form/);
  assert.match(hook, /clearTimeout/);
  assert.match(css, /data-closing\]::backdrop/);
  assert.match(css, /dialog-dismiss var\(--motion-form\)/);
  assert.match(css, /:is\(button, a, summary, input, select, textarea, \[tabindex\]\):focus-visible/);
  for (const name of ['WordDetailModal', 'ProcessingModal', 'ExpressionSelect']) {
    const source = readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /inert=\{closing\}/);
  }
});
