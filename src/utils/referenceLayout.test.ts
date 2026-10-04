import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WordDetailModal } from '../components/WordDetailModal';
import { RewritePracticeCard } from '../components/RewritePracticeCard';
import type { VocabularyItem, RewritePracticeItem } from '../types';

const vocab = { id: 'reference', term: 'undivided attention', type: 'phrase', partOfSpeech: 'noun phrase', meaningZh: '全神贯注', definitionEn: 'Complete attention.', example: 'Please give me your undivided attention.', collocations: ['give undivided attention'] } as VocabularyItem;

test('desktop inline detail preserves teaching content and actions without modal-only closing controls', () => {
  const props = { vocab, isOpen: true, isInWordbook: true, onClose: () => {}, onToggleWordbook: () => {} };
  const panel = renderToStaticMarkup(React.createElement(WordDetailModal, { ...props, inline: true }));
  assert.match(panel, /<aside/);
  assert.doesNotMatch(panel.match(/<details[^>]*>/)![0], /\bopen/);
  assert.doesNotMatch(panel, /<dialog|关闭词汇详情/);
  for (const text of [vocab.term, vocab.definitionEn, vocab.example, vocab.collocations[0], '移出生词本']) assert.ok(panel.includes(text));
  const modal = renderToStaticMarkup(React.createElement(WordDetailModal, props));
  assert.match(modal, /<dialog/);
  assert.match(modal, /关闭词汇详情/);
  assert.match(modal, /data-dialog-initial-focus/);
});

test('selecting a desktop term can expand its native disclosure', () => {
  const panel = renderToStaticMarkup(React.createElement(WordDetailModal, { vocab, isOpen: true, inline: true, inlineExpanded: true, isInWordbook: true, onClose: () => {}, onToggleWordbook: () => {} }));
  assert.match(panel, /<details[^>]*open=""/);
  assert.match(panel, /<summary/);
});

test('workbook presents the target before the original and uses a multiline answer without revealing the reference', () => {
  const item = { id: 'workbook', originalSentence: 'She listened carefully.', target: 'undivided attention', referenceAnswer: 'She gave me her undivided attention.' } as RewritePracticeItem;
  const html = renderToStaticMarkup(React.createElement(RewritePracticeCard, { item, index: 0, cefrLevel: 'B1', targetLanguage: 'zh-CN' }));
  assert.ok(html.indexOf(item.target) < html.indexOf(item.originalSentence));
  assert.match(html, /<textarea/);
  assert.match(html, /for="rewrite-answer-workbook"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /She gave me her/);
});
