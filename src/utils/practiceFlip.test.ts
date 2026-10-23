import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PracticeVocabularyCard } from '../components/PracticeVocabularyCard';
import type { VocabularyItem } from '../types';

const vocab = { id: 'a', type: 'word', term: 'considerate', phonetic: '/kənˈsɪd.ər.ət/', partOfSpeech: '形容词', definitionEn: 'Showing care.', example: 'She said, “Be considerate.”', collocations: ['considerate of others'] } as VocabularyItem;
test('both faces preserve the same word header; reverse details and ratings stay inside the card', () => {
  const html = renderToStaticMarkup(React.createElement(PracticeVocabularyCard, {
    vocab, meaning: '体贴的', revealed: true, disabled: false, onFlip() {}, onPronounce() {},
    ratings: React.createElement('button', null, 'Good'),
  }));
  assert.equal((html.match(/<h3 class="practice-vocabulary-card__term">considerate<\/h3>/g) ?? []).length, 2);
  assert.equal((html.match(/practice-vocabulary-card__phonetic/g) ?? []).length, 2);
  assert.equal((html.match(/practice-vocabulary-card__pos/g) ?? []).length, 2);
  assert.match(html, /data-flip-ignore="true"[^>]*role="region"/);
  assert.match(html, /<footer[^>]*data-flip-ignore="true"[^>]*>.*Good<\/button><\/footer>/);
  assert.match(html, /She said, “Be considerate.”/);
  assert.doesNotMatch(html, /查看学习详情/);
});
test('missing phonetics produce no empty placeholder and collocations start collapsed', () => {
  const html = renderToStaticMarkup(React.createElement(PracticeVocabularyCard, {
    vocab: {...vocab, phonetic: ''}, meaning: '体贴的', revealed: false, disabled: false,
    onFlip() {}, onPronounce() {}, ratings: null,
  }));
  assert.doesNotMatch(html, /practice-vocabulary-card__phonetic|<details open/);
});
