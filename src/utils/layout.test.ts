import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RewritePracticeCard } from '../components/RewritePracticeCard';
import { ProcessingModal } from '../components/ProcessingModal';
import type { RewritePracticeItem } from '../types';

test('shared layout gives every page the same gutters and task-specific widths', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  assert.match(css, /--page-gutter: 1rem/);
  assert.match(css, /--page-gutter: 1\.5rem/);
  assert.match(css, /--page-gutter: 2rem/);
  for (const name of ['HomeView', 'ReadingView', 'WordbookView', 'ReviewView', 'ReadingHistoryView']) {
    const source = readFileSync(new URL(`../views/${name}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /page-shell/);
  }
  assert.match(css, /\.reading-prose[^}]*max-width: 70ch/);
  assert.match(css, /\.app-dialog[^}]*100dvh/);
});

test('long exercise targets are not pinned beside the question on narrow screens', () => {
  const item = { id: 'layout', originalSentence: 'This is a sentence to rewrite.', target: 'take something into consideration', referenceAnswer: 'Take this into consideration.' } as RewritePracticeItem;
  const html = renderToStaticMarkup(React.createElement(RewritePracticeCard, { item, index: 0, }));
  assert.match(html, /exercise-heading/);
  assert.match(html, /exercise-target/);
  assert.match(html, /take something into consideration/);
  assert.match(html, /min-w-0 min-h-11 flex-1/);
});

test('processing overlay uses a bounded, scrollable dialog without changing cancellation rules', () => {
  const html = renderToStaticMarkup(React.createElement(ProcessingModal, { isOpen: true, status: 'Generating', canCancel: true, onCancel: () => {} }));
  assert.match(html, /app-dialog/);
  assert.match(html, /w-\[calc\(100%_-_2rem\)\]/);
  assert.match(html, /已发送的 AI 请求仍可能计入额度/);
  assert.match(html, /取消本次操作/);
});
