import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { editableExample, editableRoot, entryExamples, prepareEditor } from './vocabularyEditor';
import { basicVocabulary, legacyDetails } from './vocabularyDetails';
import { EntryExample } from '../components/PhraseUsage';
import type { LearningEntry } from '../types';

test('legacy sentences normalize once and clearing English keeps the same editable fields', () => {
  const old = { id: 'e', text: 'hesitate to ask', meaningZh: '迟疑', example: 'I hesitate to ask.', exampleTranslation: '我犹豫是否要问。' };
  const next = editableExample(old);
  assert.equal(next.text, old.example);
  assert.equal(next.meaningZh, old.exampleTranslation);
  assert.equal(next.associatedExpression, old.text);
  assert.equal(next.associatedMeaningZh, old.meaningZh);
  assert.equal(next.senseMeaningZh, old.meaningZh);
  assert.equal(next.example, undefined);
  assert.deepEqual(editableExample(next), next);
  assert.deepEqual(editableExample({ ...next, text: '' }), { ...next, text: '' });
  assert.equal(old.text, 'hesitate to ask');
});

test('legacy root migrates at editor entry and cannot resurrect a deleted part', () => {
  const old = { id: 'r', text: 'haer-', meaningZh: '停滞', morphology: { root: 'hesit', meaningZh: '粘附', parts: [{ kind: 'suffix' as const, text: 'ate', meaningZh: '动词后缀' }], explanation: '词源说明', mnemonic: '', related: [] } };
  const next = editableRoot(old);
  assert.deepEqual(next.morphology?.parts.map(part => part.text), ['hesit', 'ate']);
  assert.equal('root' in next.morphology!, false);
  assert.equal(next.text, '');
  const removed = { ...next, morphology: { ...next.morphology!, parts: next.morphology!.parts.slice(1) } };
  assert.deepEqual(editableRoot(removed), removed);
  const details = legacyDetails(basicVocabulary('hesitate'));
  details.sections.roots = [old];
  assert.equal(prepareEditor(details, 'roots').sections.roots[0].text, '');
  assert.equal(details.sections.roots[0].text, 'haer-');
});

test('multiple paired examples retain order, legacy content and individual speech controls', () => {
  const entry: LearningEntry = { id: 'p', text: 'hesitate to ask', meaningZh: '犹豫是否询问', example: 'I hesitated.', exampleTranslation: '我犹豫了。', examples: [{ id: 'new', english: 'Ask me.', chinese: '问我。' }] };
  assert.deepEqual(entryExamples(entry).map(pair => pair.english), ['I hesitated.', 'Ask me.']);
  const html = renderToStaticMarkup(<EntryExample entry={entry} pronounce={() => {}}/>);
  for (const text of ['I hesitated.', '我犹豫了。', 'Ask me.', '问我。', '朗读例句：Ask me.']) assert.ok(html.includes(text));
  assert.equal(entryExamples({ ...entry, examples: [{ id: 'same', english: entry.example!, chinese: entry.exampleTranslation! }] }).length, 1);
});
