import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { PracticeHubView } from '../views/PracticeHubView';
import { RewritePracticeView } from '../views/RewritePracticeView';
import { Navbar } from '../components/Navbar';
import { InstalledAppBottomNav } from '../components/InstalledAppBottomNav';
import { ReviewView } from '../views/ReviewView';

test('hub presents actual counts and two entrances before the live review', () => {
  const html = renderToStaticMarkup(React.createElement(PracticeHubView, { exerciseCount: 4, vocabularyCount: 5, onOpenRewrite() {}, onOpenWordbook() {}, children: React.createElement('div', null, 'Actual review') }));
  assert.match(html, /4 道改写练习/);
  assert.match(html, /已添加 5 个表达/);
  assert.ok(html.indexOf('进入练习') < html.indexOf('practice-review'));
  assert.ok(html.indexOf('查看生词本') < html.indexOf('Actual review'));
  assert.match(html, /id="practice-review"/);
});

test('web and installed navigation keep the unified destination active in both detail views', () => {
  for (const activeTab of ['rewrite', 'wordbook'] as const) {
    const props = { activeTab, setActiveTab() {}, reviewCount: 5, hasCurrentReading: true, targetLanguage: 'zh-CN' };
    for (const Component of [Navbar, InstalledAppBottomNav]) {
      const html = renderToStaticMarkup(React.createElement(Component, props));
      assert.match(html, /aria-label="练习与生词，5 个词条"[^>]*aria-current="page"/);
      assert.doesNotMatch(html, /aria-label="复习，|aria-label="生词本"/);
    }
  }
});

test('reading no longer duplicates exercises; empty practice and embedded review have correct heading hierarchy', () => {
  const reading = readFileSync(new URL('../views/ReadingView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(reading, /<RewritePracticeCard/);
  assert.match(reading, /onOpenPractice/);
  const empty = renderToStaticMarkup(React.createElement(RewritePracticeView, { reading: null, targetLanguage: 'zh-CN', onBack() {} }));
  assert.match(empty, /请先生成或打开一篇短文/);
  const review = renderToStaticMarkup(React.createElement(ReviewView, { embedded: true, allVocabularies: [], onRate: async () => {}, onRefresh() {}, targetLanguage: 'zh-CN', onLanguageChange() {}, onBatchUpdateVocabularies() {} }));
  assert.match(review, /<h2[^>]*>词汇复习<\/h2>/);
  assert.doesNotMatch(review, /<h1/);
});
