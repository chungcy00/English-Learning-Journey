import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('simple status selects work in both layouts without restoring custom popups', () => {
  const wordbook = read('../views/WordbookView.tsx');
  const app = read('../App.tsx');
  const css = read('../index.css');
  assert.doesNotMatch(wordbook, /LearningStatusPicker|wordbook-accordion-status/);
  assert.equal((wordbook.match(/<VocabularyStatusSelect vocab=\{vocab\} onUpdate=\{onUpdateStatus\}/g) || []).length, 2);
  assert.match(app, /db\.vocabulary\.update\(id, \{ status, updatedAt \}\)/);
  const select = read('../components/VocabularyStatusSelect.tsx');
  assert.match(select, /await onUpdate\(vocab.id, status\)/);
  assert.match(select, /状态未保存，请重试/);
  assert.doesNotMatch(css, /learning-status-|wordbook-accordion-status/);
  assert.equal(existsSync(new URL('../components/LearningStatusPicker.tsx', import.meta.url)), false);
  assert.match(wordbook, /filterSavedVocabulary/);
  assert.match(app, /recordReview/);
});

test('status filters wrap on phones and retain independent pressed-state buttons', () => {
  const source = read('../views/WordbookView.tsx');
  assert.match(source, /role="group" aria-label="按学习状态筛选"/);
  assert.match(source, /type="button"\s+aria-pressed=\{statusFilter === status\}\s+onClick=\{\(\) => setStatusFilter\(status\)\}/);
  const css = read('../index.css');
  assert.doesNotMatch(css, /\.wordbook-status-filters\s*\{[^}]*flex-wrap:\s*nowrap/);
  assert.match(css, /\.wordbook-status-filters\s*\{[^}]*flex-wrap:\s*wrap/);
});

test('wordbook suggestions expose matching list and active option identities plus pointer activation', () => {
  const source = read('../views/WordbookView.tsx');
  assert.match(source, /aria-controls=\{suggestionPanelVisible \? 'wordbook-expression-options'/);
  assert.match(source, /id="wordbook-expression-options" role="listbox"/);
  assert.match(source, /aria-activedescendant=/);
  assert.match(source, /id=\{`wordbook-expression-option-\$\{index\}`\}/);
  assert.match(source, /onClick=\{\(\) => \{\s*setSearch\(term\)/);
  assert.match(source, /isSuggestionOpen && searchSuggestions\[activeSuggestionIndex\]/);
});

test('generation selectors and history card actions have concise accessible names', () => {
  const wordbook = read('../views/WordbookView.tsx');
  assert.match(wordbook, /aria-label="生成短文的类型"/);
  assert.match(wordbook, /aria-label="生成短文的篇幅"/);
  assert.match(read('../views/ReadingHistoryView.tsx'), /aria-label=\{`继续阅读：\$\{item.title\}`\}/);
});
