import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('all learning-status inputs and live update wiring are removed', () => {
 assert.equal(existsSync(new URL('../components/VocabularyStatusSelect.tsx',import.meta.url)),false);
 for(const path of ['../App.tsx','../views/WordbookView.tsx','../components/WordbookEntryDetails.tsx','../components/HistoryVocabularyTasks.tsx'])assert.doesNotMatch(read(path),/onUpdateStatus|handleUpdateStatus|wordbook-state-badge|wordbook-status-filters|StatusReview|history-mastery/);
});

test('suggestions use normal keyboard-accessible add buttons rather than nested listbox actions', () => {
  const source = read('../views/WordbookView.tsx');
  assert.match(source, /aria-label=\{`添加 \$\{term\}`\}/);
  assert.match(source, /aria-label="清除搜索"/);
  assert.doesNotMatch(source, /tabIndex=\{-1\}|wordbook-add-disclosure|collectionSearch/);
});
test('history actions retain concise accessible names', () => {
  assert.match(read('../views/ReadingHistoryView.tsx'), /aria-label=\{`阅读：\$\{item.title\}`\}/);
});
