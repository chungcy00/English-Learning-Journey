import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReviewFlipCard } from '../components/ReviewFlipCard';
import { readFileSync } from 'node:fs';

test('exactly one flip face is exposed; the hidden face is inert in either direction', () => {
  for (const revealed of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(ReviewFlipCard, { revealed, front: 'front', children: 'back' }));
    assert.equal((html.match(/aria-hidden="true" inert=""/g) || []).length, 1);
    assert.equal((html.match(/data-active-face=""/g) || []).length, 1);
    assert.match(html, revealed ? /is-revealed/ : /review-flip-inner\s*"/);
  }
});
test('flip has reduced-motion fallback and does not use fixed-height clipping', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  assert.match(css, /\.review-flip-inner\.is-revealed \{ transform: rotateY\(180deg\)/);
  assert.match(css, /prefers-reduced-motion: reduce[^}]+review-flip-inner[\s\S]*?transform: none; transition: none/);
});
