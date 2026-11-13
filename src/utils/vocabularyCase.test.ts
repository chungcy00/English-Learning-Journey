import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vocabularyHeadword } from './vocabularyCase';
import { vocabularyKey } from './vocabularyDetails';

test('ordinary headwords normalize user input in every case without altering sentence text', () => {
  for (const word of ['Conflict', 'CONFLICT', 'conflict', 'cOnFlIcT']) assert.equal(vocabularyHeadword(word), 'conflict');
  assert.equal(vocabularyHeadword('Gist'), 'gist');
  assert.equal(vocabularyHeadword('BREAK THE ICE'), 'break the ice');
  assert.equal(vocabularyHeadword('APPLE'), 'apple');
});
test('necessary capitals and proper-name metadata survive headword normalization', () => {
  for (const [input, output] of [['english', 'English'], ['LONDON', 'London'], ['iPHONE', 'iPhone'], ['usa', 'USA'], ['i', 'I'], ['US', 'US'], ['us', 'us'], ['Polish', 'Polish'], ['polish', 'polish']]) assert.equal(vocabularyHeadword(input), output);
  assert.equal(vocabularyHeadword('oxford', 'proper noun'), 'Oxford');
  assert.equal(vocabularyHeadword('APPLE', 'proper noun'), 'Apple');
  assert.equal(vocabularyKey('Conflict', 'word'), 'word:Conflict');
  assert.notEqual(vocabularyKey('US', 'word'), vocabularyKey('us', 'word'));
});
