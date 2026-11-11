import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReviewView } from '../views/ReviewView';
import { writeReviewProgress } from './reviewProgress';
import type { VocabularyItem } from '../types';

test('revealed review uses six learning tabs with independent bookmarks without memory ratings', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  let stored = '';
  try {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
      getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; },
    } });
    writeReviewProgress({ currentId: 'qa', ids: ['qa'], revealed: true, completed: false });
    const html = renderToStaticMarkup(React.createElement(ReviewView, {
      allVocabularies: [{ id: 'qa', term: 'catch up', collocations: ['catch up with friends'], partOfSpeech: 'phrasal verb' } as VocabularyItem],
      onRate: async () => {}, onRefresh: () => {}, }));
    assert.equal((html.match(/role="tab"/g) || []).length,6);
    assert.match(html, /词汇六栏学习资料/);
    assert.match(html, /用法解析/);
    assert.doesNotMatch(html, /review-rating-bar|评价记忆程度|>Again<|>Hard<|>Good<|>Easy</);
    assert.match(html, /aria-label="播放 catch up 的发音"/);
    assert.doesNotMatch(html, /一次生成六栏资料|lexicon-generate/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
