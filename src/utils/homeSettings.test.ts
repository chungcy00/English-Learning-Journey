import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeView } from '../views/HomeView';
import { READING_STYLES } from './readingStyles';
import type { AppSettings, ReadingRecord } from '../types';

const settings = { cefr: 'B2', defaultReadingType: 'dialogue', defaultReadingStyle: 'warm', defaultLength: 'long', vocabularyCount: 10 } as AppSettings;
const render = (isLoading = false) => renderToStaticMarkup(React.createElement(HomeView, { settings, onGenerate: () => {}, isLoading }));

test('topic suggestions and reading bookmarks keep at least 44px touch targets', () => {
  const prompts = render().match(/<section class="home-prompts">[\s\S]*?<\/section>/)![0];
  const buttons = prompts.match(/<button\b[^>]*>/g)!;
  assert.equal(buttons.length, 3);
  for (const button of buttons) assert.match(button, /\bmin-h-11\b/);
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const bookmark = css.match(/\.reading-vocabulary__bookmark\s*\{([^}]+)\}/)![1];
  assert.match(bookmark, /min-width:\s*2\.75rem/);
  assert.match(bookmark, /min-height:\s*2\.75rem/);
});

test('continue reading only appears for a real current passage and uses its actual vocabulary count', () => {
  assert.doesNotMatch(render(), /continue-reading-title/);
  const currentReading = { title: 'A real saved passage', cefrLevel: 'B1', selectedVocabulary: [{ term: 'genuine' }] } as ReadingRecord;
  const html = renderToStaticMarkup(React.createElement(HomeView, { settings, onGenerate: () => {}, isLoading: false, currentReading, onContinueReading: () => {} }));
  assert.match(html, /A real saved passage/);
  assert.match(html, /B1 · 1 个精选词汇/);
});

test('all reading parameters stay available inside a closed native disclosure', () => {
  const html = render();
  const details = html.match(/<details\b[^>]*>[\s\S]*?<\/details>/)![0];
  assert.doesNotMatch(details, /^<details[^>]*\bopen(?:=|\s|>)/);
  assert.match(details, /aria-labelledby="cefr-label"/);
  assert.match(details, /aria-labelledby="vocab-count-label"/);
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
  assert.match(html, /B2 · 情境对话 · 250–350 词 · 10 个词 · Warm（温暖治愈）/);
  assert.match(html, /能力参考：理解较复杂内容，清楚表达观点与理由。/);
  assert.match(html, /aria-describedby="cefr-ability-hint"/);
  assert.match(html, /<label for="generation-input"/);
  assert.doesNotMatch(html, /将按词表处理/);
  assert.doesNotMatch(html, /Generation Settings|自然叙述与对话|自动 Humanise|语境记忆与AI反馈|学习册随身练习/);
});
