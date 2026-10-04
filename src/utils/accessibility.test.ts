import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Navbar } from '../components/Navbar';
import { WordDetailModal } from '../components/WordDetailModal';
import { WordbookRemovalDialog } from '../components/WordbookRemovalDialog';
import type { VocabularyItem } from '../types';

const vocab = { id: 'test', term: 'break the ice', type: 'idiom', partOfSpeech: 'idiom', collocations: [] } as unknown as VocabularyItem;

test('all five navigation destinations have names and current-state semantics on every viewport', () => {
  const html = renderToStaticMarkup(React.createElement(Navbar, { activeTab: 'reading', setActiveTab: () => {}, reviewCount: 22, hasCurrentReading: true, targetLanguage: 'zh-CN' }));
  assert.equal((html.match(/aria-label=/g) || []).length, 6); // nav + five destinations
  assert.match(html, /aria-label="当前阅读" aria-current="page"/);
  assert.match(html, /aria-label="复习，22 个词条"/);
  assert.doesNotMatch(html, /hidden md:inline/);
});

test('word details use a named native dialog and explicit removal, not a misleading saved-state button', () => {
  const html = renderToStaticMarkup(React.createElement(WordDetailModal, { vocab, isOpen: true, onClose: () => {}, isInWordbook: true, onToggleWordbook: () => {} }));
  assert.match(html, /<dialog[^>]+aria-labelledby="word-detail-title"/);
  assert.match(html, /aria-label="关闭词汇详情"/);
  assert.match(html, /aria-label="移出生词本：break the ice"/);
  assert.match(html, /移出生词本<\/span>/);
});

test('rendering a removal request does not delete anything and provides a safe cancel-first choice', () => {
  let writes = 0;
  const html = renderToStaticMarkup(React.createElement(WordbookRemovalDialog, { term: vocab.term, onCancel: () => {}, onConfirm: async () => { writes++; } }));
  assert.equal(writes, 0);
  assert.match(html, /break the ice/);
  assert.match(html, /不再出现在复习/);
  assert.doesNotMatch(html, /取消会保留/);
  assert.match(html, /data-dialog-initial-focus/);
  assert.match(html, />取消<\/button>/);
  assert.match(html, />确认移除<\/button>/);
});

function luminance(hex: string) {
  const rgb = hex.replace('#', '').match(/../g)!.map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
test('normal-size secondary text, button text, placeholders and warm badge text meet 4.5:1', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const token = (name: string) => css.match(new RegExp(`--${name}: (#[A-Fa-f0-9]{6})`))![1];
  for (const [foreground, background] of [
    [token('text-secondary'), token('bg-primary')], [token('text-secondary'), token('bg-alt')],
    [token('bg-primary'), token('accent-primary')], ['#646657', token('bg-primary')],
    [token('text-primary'), token('accent-warm')], ['#77543D', token('bg-alt')],
    ...['#5F654D', '#77543D', '#4B6B6E', '#7A5868'].map(background => ['#FAF7F2', background]),
  ]) {
    const levels = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((levels[0] + 0.05) / (levels[1] + 0.05) >= 4.5, `${foreground} on ${background}`);
  }
});
