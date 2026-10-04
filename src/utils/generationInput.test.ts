import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSpecifiedVocabulary, CEFR_ABILITY_HINTS } from './generationInput';

test('no delimiter means a topic or single expression, not a word list', () => {
  for (const input of ['', 'Small talk at work', 'break the ice', '雨天里的小惊喜']) assert.equal(parseSpecifiedVocabulary(input), undefined);
});
test('preview preserves every existing delimiter, phrase, order and duplicate', () => {
  assert.deepEqual(parseSpecifiedVocabulary(' genuine, break the ice，catch up、help out; genuine； '), ['genuine', 'break the ice', 'catch up', 'help out', 'genuine']);
  assert.deepEqual(parseSpecifiedVocabulary(', ;，；、'), []);
  assert.deepEqual(parseSpecifiedVocabulary('A rainy day, in town'), ['A rainy day', 'in town']);
});
test('all available degrees have distinct ability references', () => {
  assert.deepEqual(Object.keys(CEFR_ABILITY_HINTS), ['A2', 'B1', 'B2', 'C1']);
  assert.equal(new Set(Object.values(CEFR_ABILITY_HINTS)).size, 4);
});
