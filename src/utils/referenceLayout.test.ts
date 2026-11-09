import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WordDetailModal } from '../components/WordDetailModal';
import { RewritePracticeCard } from '../components/RewritePracticeCard';
import type { VocabularyItem, RewritePracticeItem } from '../types';

const vocab = { id: 'reference', term: 'undivided attention', type: 'phrase', partOfSpeech: 'noun phrase', meaningZh: '全神贯注', definitionEn: 'Complete attention.', example: 'Please give me your undivided attention.', collocations: ['give undivided attention'] } as VocabularyItem;

test('inline word details use the same six-section learning panel without a native dialog', () => {
 const html=renderToStaticMarkup(React.createElement(WordDetailModal,{vocab,isOpen:true,inline:true,isInWordbook:true,onClose(){},onToggleWordbook(){}}));
 assert.doesNotMatch(html,/<dialog/); assert.match(html,/word-detail-inline/); assert.match(html,/用法辨析/); assert.ok(html.includes(vocab.example));
});

test('word details show one initial example tab and six keyboard tabs', () => {
 const html=renderToStaticMarkup(React.createElement(WordDetailModal,{vocab,isOpen:true,inline:true,isInWordbook:true,onClose(){},onToggleWordbook(){}}));
 assert.equal((html.match(/role="tab"/g)||[]).length,6); assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
});

test('embedded details retain local learning material without a modal', () => {
 const html=renderToStaticMarkup(React.createElement(WordDetailModal,{vocab,isOpen:true,embedded:true,isInWordbook:true,onClose(){},onToggleWordbook(){}}));
 assert.doesNotMatch(html,/<dialog/); assert.match(html,/word-detail-inline/); assert.ok(html.includes(vocab.example)); assert.match(html,/一次生成六栏资料/);
});

test('workbook presents the target before the original and uses a multiline answer without revealing the reference', () => {
  const item = { id: 'workbook', originalSentence: 'She listened carefully.', target: 'undivided attention', referenceAnswer: 'She gave me her undivided attention.' } as RewritePracticeItem;
  const html = renderToStaticMarkup(React.createElement(RewritePracticeCard, { item, index: 0, cefrLevel: 'B1', }));
  assert.ok(html.indexOf(item.target) < html.indexOf(item.originalSentence));
  assert.match(html, /<textarea/);
  assert.match(html, /for="rewrite-answer-workbook"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /She gave me her/);
});
