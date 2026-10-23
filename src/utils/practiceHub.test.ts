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
  assert.match(html, /4 道练习 · 巩固英文表达/);
  assert.match(html, /已添加 5 个表达/);
  assert.ok(html.indexOf('句子改写') < html.indexOf('practice-review'));
  assert.equal((html.match(/<button/g) || []).length, 2);
  assert.ok(html.indexOf('我的生词本') < html.indexOf('Actual review'));
  assert.doesNotMatch(html, /practice-entry-action|Rewrite the Sentence/);
  assert.match(html, /id="practice-review"/);
});

test('web and installed navigation keep the unified destination active in both detail views', () => {
  for (const activeTab of ['rewrite', 'wordbook'] as const) {
    const props = { activeTab, setActiveTab() {}, reviewCount: 5, hasCurrentReading: true, };
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
  const empty = renderToStaticMarkup(React.createElement(RewritePracticeView, { reading: null, onBack() {} }));
  assert.match(empty, /请先生成或打开一篇短文/);
  const review = renderToStaticMarkup(React.createElement(ReviewView, { embedded: true, allVocabularies: [], onRate: async () => {}, onRefresh() {}, }));
  assert.match(review, /<h2[^>]*>词汇复习<\/h2>/);
  assert.doesNotMatch(review, /<h1/);
});

test('rewrite workspace keeps real evaluated progress and renders one keyed question with step buttons', () => {
  const source = readFileSync(new URL('../views/RewritePracticeView.tsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../components/RewritePracticeCard.tsx', import.meta.url), 'utf8');
  assert.match(source, /entry\.evaluation \? 'evaluated'/);
  assert.match(source, /<progress[^>]*value=\{completed\}[^>]*max=\{exercises.length\}/);
  assert.match(source, /aria-current=\{active \? 'step'/);
  assert.match(source, /item=\{current\}/);
  assert.equal((source.match(/<RewritePracticeCard/g) || []).length, 1);
  assert.doesNotMatch(source, /href=|重置练习|提交本组练习/);
  assert.match(card, /id=\{`rewrite-exercise-\$\{item.id\}`\}/);
});


test('hub disables unavailable rewrite and keeps the empty wordbook accessible', () => {
  const html = renderToStaticMarkup(React.createElement(PracticeHubView, { exerciseCount: 0, vocabularyCount: 0, onOpenRewrite() {}, onOpenWordbook() {}, children: null }));
  assert.match(html, /practice-entry--rewrite[^>]*disabled=""/);
  assert.match(html, /当前短文暂无改写练习/);
  assert.match(html, /已添加 0 个表达/);
  assert.doesNotMatch(html, /practice-entry--wordbook[^>]*disabled/);
});

test('embedded review has bounded one-item pagination and no empty pager', () => {
  const props = { embedded: true, onRate: async () => {}, onRefresh() {} };
  const item = {id:'one',term:'genuine',type:'word',meaningZh:'真诚的',partOfSpeech:'adjective'} as import('../types').VocabularyItem;
  const single = renderToStaticMarkup(React.createElement(ReviewView,{...props,allVocabularies:[item]}));
  assert.match(single, /aria-label="上一张词汇"[^>]*disabled=""/);
  assert.match(single, /aria-label="下一张词汇"[^>]*disabled=""/);
  assert.match(single, /role="status"[^>]*>1 \/ 1</);
  assert.match(single, /practice-vocabulary-card__term/);
  const empty = renderToStaticMarkup(React.createElement(ReviewView,{...props,allVocabularies:[]}));
  assert.doesNotMatch(empty, /practice-review-progress|review-flip-stage|0 \/ 0/);
});
