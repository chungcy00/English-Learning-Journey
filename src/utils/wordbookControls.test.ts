import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('status updates keep native menus, translated labels and existing scheduling fields', () => {
  const select = read('../components/VocabularyStatusSelect.tsx');
  assert.match(select, /await onUpdate\(vocab.id, status\)/);
  assert.match(select, /wordbookStatuses\[status\]/);
  assert.match(select, /状态未保存，请重试/);
  assert.match(read('../App.tsx'), /db\.vocabulary\.update\(id, \{ status, updatedAt \}\)/);
  assert.equal(existsSync(new URL('../components/LearningStatusPicker.tsx', import.meta.url)), false);
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
