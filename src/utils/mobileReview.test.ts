import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReviewView } from '../views/ReviewView';
import { writeReviewProgress } from './reviewProgress';
import type { VocabularyItem } from '../types';

test('revealed review uses a closed native collocation disclosure and large rating controls', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  let stored = '';
  try {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
      getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; },
    } });
    writeReviewProgress({ currentId: 'qa', ids: ['qa'], revealed: true, completed: false });
    const html = renderToStaticMarkup(React.createElement(ReviewView, {
      allVocabularies: [{ id: 'qa', term: 'catch up', collocations: ['catch up with friends'], partOfSpeech: 'phrasal verb' } as VocabularyItem],
      onRate: async () => {}, onRefresh: () => {}, targetLanguage: 'zh-CN', onLanguageChange: () => {}, onBatchUpdateVocabularies: () => {},
    }));
    assert.match(html, /<details[^>]*>/);
    assert.doesNotMatch(html, /<details[^>]*open/);
    assert.match(html, /review-rating-bar/);
    assert.equal((html.match(/min-h-14/g) || []).length, 4);
    assert.match(html, /aria-label="评价记忆程度"/);
    assert.match(html, /aria-label="播放 catch up 的发音"/);
    assert.match(html, /catch up with friends/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
