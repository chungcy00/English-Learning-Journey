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

test('wordbook distinguishes the degree-scoped list, passage-only search and all-entry review without showing CEFR', () => {
  const html = renderToStaticMarkup(React.createElement(WordbookView, {
    vocabularyList: entries, readings: [], currentReading: reading, onDeleteVocab: noop, onUpdateStatus: noop,
    onGenerateFromWordbook: noop, isGenerating: false, targetLanguage: 'zh-CN', onLanguageChange: noop,
    onBatchUpdateVocabularies: noop, currentCefr: 'B1', onSaveVocab: async () => {}, onOpenReview: noop,
  }));
  assert.match(html, /按所选程度显示：1 项/);
  assert.match(html, /复习生词本全部 2 项/);
  assert.match(html, /搜索并添加当前短文的表达/);
  assert.match(html, /全部状态/);
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ''), /B1|B2|CEFR|dread|搜索与添加提示/);
});

test('review count includes vocabulary from every degree', () => {
  const html = renderToStaticMarkup(React.createElement(ReviewView, { allVocabularies: entries, onRate: noop, onRefresh: noop, targetLanguage: 'zh-CN', onLanguageChange: noop, onBatchUpdateVocabularies: noop }));
  assert.match(html, /生词本全部词条：2 项/);
});

test('reading count explicitly identifies the selected count and limit', () => {
  const html = renderToStaticMarkup(React.createElement(ReadingVocabularyEditor, { reading, knownVocabulary: entries, targetLanguage: 'zh-CN', onSave: async () => {} }));
  assert.match(html, /已精选 1\/8 项/);
  assert.match(html, /当前短文已精选 1 项，上限 8 项/);
});
