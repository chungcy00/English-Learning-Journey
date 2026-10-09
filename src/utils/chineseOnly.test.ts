import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { getLocalizedVocabMeaning, getLocalizedExampleTranslation } from './i18n';
import type { VocabularyItem } from '../types';

test('Chinese meanings and examples ignore legacy foreign-language caches', () => {
  const vocab = { id: 'test', term: 'kind', meaningZh: '友善的', translations: {
    ja: { meaning: '親切', exampleTranslation: '日本語' },
    'zh-CN': { meaning: '体贴的', exampleTranslation: '她很体贴。' },
  }, type: 'word', phonetic: '', partOfSpeech: 'adjective', definitionEn: 'Friendly.',
  example: 'She is kind.', collocations: [], status: 'New', createdAt: 0, updatedAt: 0,
  nextReviewDate: 0, reviewCount: 0, currentInterval: 0 } satisfies VocabularyItem;
  assert.equal(getLocalizedVocabMeaning(vocab), '体贴的');
  assert.equal(getLocalizedExampleTranslation(vocab), '她很体贴。');
  delete vocab.translations!['zh-CN'];
  assert.equal(getLocalizedVocabMeaning(vocab), '友善的');
  assert.equal(getLocalizedExampleTranslation(vocab), undefined);
});

test('removed language selectors and PDF export have no live source or dependency', () => {
  for (const name of ['ReadingView', 'ReviewView', 'WordbookView']) {
    const source = readFileSync(new URL(`../views/${name}.tsx`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /LanguageSelector|SUPPORTED_LANGUAGES|onLanguageChange|exportReadingToPdf/);
  }
  const reading = readFileSync(new URL('../views/ReadingView.tsx', import.meta.url), 'utf8');
  assert.match(reading, /translations\?\.\['zh-CN'\]/);
  assert.doesNotMatch(reading, /\bPDF\b/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies['html2pdf.js'], undefined);
  assert.equal(pkg.dependencies.jspdf, undefined);
  assert.equal(existsSync(new URL('../components/LanguageSelector.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../services/pdfGenerator.ts', import.meta.url)), false);
});
