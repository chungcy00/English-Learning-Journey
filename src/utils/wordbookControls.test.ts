import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('manual learning-status controls and all custom popup styles are removed, with filters retained', () => {
  const wordbook = read('../views/WordbookView.tsx');
  const app = read('../App.tsx');
  const css = read('../index.css');
  assert.doesNotMatch(wordbook, /LearningStatusPicker|onUpdateStatus|学习状态|<option value="(?:New|Learning|Difficult|Mastered)"/);
  assert.doesNotMatch(app, /handleUpdateStatus|onUpdateStatus/);
  assert.doesNotMatch(css, /learning-status-|wordbook-accordion-status/);
  assert.equal(existsSync(new URL('../components/LearningStatusPicker.tsx', import.meta.url)), false);
  assert.match(wordbook, /filterSavedVocabulary/);
  assert.match(app, /recordReview/);
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
  assert.match(read('../views/ReadingHistoryView.tsx'), /aria-label=\{`打开短文：\$\{item.title\}`\}/);
});
