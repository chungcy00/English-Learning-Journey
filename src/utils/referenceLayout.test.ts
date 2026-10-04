import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WordDetailModal } from '../components/WordDetailModal';
import type { VocabularyItem } from '../types';

const vocab = { id: 'reference', term: 'undivided attention', type: 'phrase', partOfSpeech: 'noun phrase', meaningZh: '全神贯注', definitionEn: 'Complete attention.', example: 'Please give me your undivided attention.', collocations: ['give undivided attention'] } as VocabularyItem;

test('desktop inline detail preserves teaching content and actions without modal-only closing controls', () => {
  const props = { vocab, isOpen: true, isInWordbook: true, onClose: () => {}, onToggleWordbook: () => {} };
  const panel = renderToStaticMarkup(React.createElement(WordDetailModal, { ...props, inline: true }));
  assert.match(panel, /<aside/);
  assert.doesNotMatch(panel, /<dialog|关闭词汇详情/);
  for (const text of [vocab.term, vocab.definitionEn, vocab.example, vocab.collocations[0], '移出生词本']) assert.ok(panel.includes(text));
  const modal = renderToStaticMarkup(React.createElement(WordDetailModal, props));
  assert.match(modal, /<dialog/);
  assert.match(modal, /关闭词汇详情/);
  assert.match(modal, /data-dialog-initial-focus/);
});
