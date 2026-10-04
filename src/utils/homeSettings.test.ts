import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeView } from '../views/HomeView';
import { READING_STYLES } from './readingStyles';
import type { AppSettings } from '../types';

const settings = { cefr: 'B2', defaultReadingType: 'dialogue', defaultReadingStyle: 'warm', defaultLength: 'long', vocabularyCount: 10 } as AppSettings;
const render = (isLoading = false) => renderToStaticMarkup(React.createElement(HomeView, { settings, onGenerate: () => {}, isLoading }));

test('CEFR and count stay outside a closed native disclosure; all optional controls remain available', () => {
  const html = render();
  const details = html.match(/<details\b[^>]*>[\s\S]*?<\/details>/)![0];
  assert.doesNotMatch(details, /^<details[^>]*\bopen(?:=|\s|>)/);
  assert.match(html.slice(0, html.indexOf('<details')), /aria-labelledby="cefr-label"/);
  assert.match(html.slice(0, html.indexOf('<details')), /aria-labelledby="vocab-count-label"/);
  for (const id of ['reading-type', 'reading-length', 'reading-style']) assert.match(details, new RegExp(`id="${id}"`));
  for (const style of READING_STYLES) assert.match(details, new RegExp(`value="${style.value}"`));
});

test('saved parameters and the collapsed summary agree without resetting defaults', () => {
  const html = render();
  assert.match(html, /aria-pressed="true"[^>]*>B2<\/button>/);
  assert.match(html, /aria-pressed="true"[^>]*>10<\/button>/);
  assert.match(html, /value="dialogue" selected=""/);
  assert.match(html, /value="long" selected=""/);
  assert.match(html, /value="warm" selected=""/);
  assert.match(html, /情境对话 · 250–350 词 · Warm（温暖治愈）/);
  assert.match(html, /能力参考：理解较复杂内容，清楚表达观点与理由。/);
  assert.match(html, /aria-describedby="cefr-ability-hint"/);
  assert.match(html, /<label for="generation-input"/);
  assert.doesNotMatch(html, /将按词表处理/);
});
