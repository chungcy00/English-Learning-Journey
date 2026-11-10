import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WordbookView } from '../views/WordbookView';
import { ReviewView } from '../views/ReviewView';
import { ReadingVocabularyEditor } from '../components/ReadingVocabularyEditor';
import type { ReadingRecord, VocabularyItem } from '../types';

const entries = ['B1', 'B2'].map((cefrLevel, index) => ({ id: String(index), term: index ? 'dread' : 'help out', cefrLevel, status: 'New', collocations: [], updatedAt: 1 })) as VocabularyItem[];
const reading = { id: 'reading', content: 'We help out.', cefrLevel: 'B1', selectedVocabulary: [entries[0]], vocabularyCount: 8 } as ReadingRecord;
const noop = () => {};

test('wordbook shows all saved degrees, distinguishes passage addition from collection filtering, and hides CEFR', () => {
  const html = renderToStaticMarkup(React.createElement(WordbookView, {
    vocabularyList: entries, readings: [], currentReading: reading, onDeleteVocab: noop, onUpdateStatus: async () => {},
    onGenerateFromWordbook: noop, isGenerating: false, currentCefr: 'B1', onSaveVocab: async () => {}, onOpenReview: noop,
  }));
  assert.match(html, /全部词条：2 项/);
  assert.doesNotMatch(html, /输入已添加的英文单词、短语或习语/);
  assert.equal((html.match(/type="search"/g)||[]).length,1);
  assert.match(html, /dread/);
  assert.match(html, /开始复习/);
  assert.match(html, /搜索并添加当前短文的表达/);
  assert.match(html, /全部/);
  assert.doesNotMatch(html, /wordbook-collection-panel/);
  assert.doesNotMatch(html, /wordbook-filter-count|wordbook-state-badge|按学习状态筛选/);
  assert.doesNotMatch(html, /显示 2 个词条/);
  assert.match(html, /字母排序/);
  assert.doesNotMatch(html, /wordbook-add-disclosure/);
  assert.doesNotMatch(html, /<details class="wordbook-saved-search/);
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ''), /B1|B2|CEFR|搜索与添加提示/);
});

test('review count includes vocabulary from every degree', () => {
  const html = renderToStaticMarkup(React.createElement(ReviewView, { allVocabularies: entries, onRate: noop, onRefresh: noop, }));
  assert.match(html, /全部 2 词/);
  assert.doesNotMatch(html, /当前模式：|单词本共/);
  assert.doesNotMatch(html, /Word 1|Reveal Details/);
});

test('reading count identifies the current selection without enforcing the generation count', () => {
  const html = renderToStaticMarkup(React.createElement(ReadingVocabularyEditor, { reading, knownVocabulary: entries, onSave: async () => {} }));
  assert.match(html, /已精选 1 项/);
  assert.doesNotMatch(html, /上限|已达/);
});
