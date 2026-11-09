import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PracticeVocabularyCard } from '../components/PracticeVocabularyCard';
import type { VocabularyItem } from '../types';

const vocab = { id: 'a', type: 'word', term: 'considerate', phonetic: '/kənˈsɪd.ər.ət/', partOfSpeech: '形容词', definitionEn: 'Showing care.', example: 'She said, “Be considerate.”', collocations: ['considerate of others'] } as VocabularyItem;
test('revealed review uses the shared six-section panel without memory ratings', () => {
  const html = renderToStaticMarkup(React.createElement(PracticeVocabularyCard, {
    vocab, meaning: '体贴的', revealed: true, disabled: false, onFlip() {}, onPronounce() {},
    ratings: React.createElement('button', null, 'Good'),
  }));
  assert.equal((html.match(/<h3 class="practice-vocabulary-card__term">considerate<\/h3>/g) ?? []).length, 2);
  assert.equal((html.match(/role="tab"/g) || []).length, 6);
  for (const text of ['例句','派生','词根','词组','英释','用法辨析','编辑基本资料','一次生成六栏资料','返回正面',vocab.example]) assert.ok(html.includes(text));
  assert.match(html, /data-flip-ignore="true"[^>]*role="region"/);
  assert.doesNotMatch(html, /practice-vocabulary-card__footer|review-rating-bar|>Good<|>Again</);
  assert.doesNotMatch(html, /practice-vocabulary-card__collocations|<details/);
});
test('the front does not mount learning details or expose answer tabs', () => {
  const html = renderToStaticMarkup(React.createElement(PracticeVocabularyCard, {
    vocab: {...vocab, phonetic: ''}, meaning: '体贴的', revealed: false, disabled: false,
    onFlip() {}, onPronounce() {}, ratings: null,
  }));
  assert.doesNotMatch(html, /practice-vocabulary-card__phonetic|role="tab"|lexicon-panel|Showing care|Be considerate/);
});
