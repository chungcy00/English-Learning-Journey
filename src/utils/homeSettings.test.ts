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

test('all reading parameters are directly available without a disclosure', () => {
  const html = render();
  assert.doesNotMatch(html, /<details|<summary/);
  assert.match(html, /aria-labelledby="cefr-label"/);
  assert.match(html, /aria-labelledby="vocab-count-label"/);
  for (const id of ['reading-type', 'reading-length', 'reading-style']) assert.match(html, new RegExp(`id="${id}"`));
  for (const style of READING_STYLES) assert.match(html, new RegExp(`value="${style.value}"`));
});

test('saved parameters stay selected without resetting defaults', () => {
  const html = render();
  assert.match(html, /aria-pressed="true"[^>]*><span>B2<\/span>/);
  assert.match(html, /aria-label="精选词汇数量">10<\/output>/);
  assert.match(html, /aria-pressed="true"[^>]*>对话<\/button>/);
  assert.match(html, /aria-pressed="true"[^>]*>长 · 250–350 词<\/button>/);
  assert.match(html, /value="warm" selected=""/);
  assert.match(html, /能力参考：理解较复杂内容，清楚表达观点与理由。/);
  assert.match(html, /aria-describedby="cefr-ability-hint"/);
  assert.match(html, /<label for="generation-input"/);
  assert.doesNotMatch(html, /将按词表处理/);
  assert.doesNotMatch(html, /Generation Settings|自然叙述与对话|自动 Humanise|语境记忆与AI反馈|学习册随身练习/);
});

test('loading blocks parameter changes and vocabulary controls expose bounded steps', () => {
  const html = render(true);
  assert.match(html, /aria-label="减少精选词汇" disabled=""/);
  assert.match(html, /aria-label="增加精选词汇" disabled=""/);
  assert.match(html, /生成中…/);
  const source = readFileSync(new URL('../views/HomeView.tsx', import.meta.url), 'utf8');
  assert.match(source, /vocabCount <= 1/);
  assert.match(source, /vocabCount >= 20/);
});
