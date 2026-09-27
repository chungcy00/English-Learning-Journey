import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vocabularyProblem } from './vocabularyPolicy';
import { getEnglishTermMatchRank, isEnglishTermQuery } from '../src/utils/englishSearch';

const vocabulary = ['pleasant', 'take a break', 'break the ice'].map((term, i) => ({
  term, type: ['word', 'phrase', 'idiom'][i], cefrLevel: 'B1',
  meaningZh: '释义', definitionEn: 'A definition.', example: 'An example.', partOfSpeech: 'expression',
}));
const reading = { reading: 'A sample.', cefrLevel: 'B1', vocabulary, rewritePractice: [{ target: 'take a break' }] };
test('accepts complete words/phrases/idioms only at the selected level and exact count', () => {
  assert.equal(vocabularyProblem(reading, 'B1', 3), null);
  assert.ok(vocabularyProblem(reading, 'B1', 5));
  assert.ok(vocabularyProblem(reading, 'B2', 3));
  assert.ok(vocabularyProblem({ ...reading, vocabulary: [vocabulary[0], vocabulary[0], vocabulary[2]] }, 'B1', 3));
  assert.ok(vocabularyProblem({ ...reading, vocabulary: vocabulary.map(v => ({ ...v, cefrLevel: 'C1' })) }, 'B1', 3));
  assert.ok(vocabularyProblem({ ...reading, rewritePractice: [{ target: 'unselected' }] }, 'B1', 3));
});
test('English term search handles words, phrase boundaries and idioms without matching translations', () => {
  assert.equal(getEnglishTermMatchRank('break the ice', 'break the ice'), 0);
  assert.equal(getEnglishTermMatchRank('break the ice', 'ice'), 2);
  assert.equal(getEnglishTermMatchRank('genuine', '真诚'), null);
  assert.equal(getEnglishTermMatchRank('considerate', 'kind'), null);
});

test('custom entries retain natural English expressions instead of splitting phrases or idioms', () => {
  for (const term of ['genuine', 'take a break', 'break the ice', 'so far, so good', "someone’s cup of tea", 'mother-in-law']) {
    assert.equal(isEnglishTermQuery(term), true, term);
    assert.equal(getEnglishTermMatchRank(term, term.toUpperCase()), 0, term);
  }
  for (const term of ['中文', '<script>', 'word; DROP', '123']) assert.equal(isEnglishTermQuery(term), false);
});
