import assert from 'node:assert/strict';
import { test } from 'node:test';
import { explainedTermProblem } from './termPolicy';
const result = { term: 'break the ice', type: 'idiom', isValidTerm: true, cefrLevel: 'B1', isInContext: true, contextQuote: 'She broke the ice with a joke.', meaningZh: '打破僵局', definitionEn: 'Make people comfortable.', example: 'Tell a joke to break the ice.', partOfSpeech: 'idiom' };
test('contextual lookup accepts natural inflections and checks exact contextual evidence', () => {
  const options = { term: 'break the ice', cefrLevel: 'B1', requireInReading: true, contextReading: 'She broke the ice with a joke.' };
  assert.equal(explainedTermProblem(result, options), null);
  assert.ok(explainedTermProblem(result, { ...options, cefrLevel: 'A2' }));
  assert.ok(explainedTermProblem(result, { ...options, contextReading: 'It was raining.' }));
  assert.ok(explainedTermProblem({ ...result, isInContext: false }, options));
  assert.ok(explainedTermProblem({ ...result, contextQuote: '' }, options));
  assert.ok(explainedTermProblem({ ...result, isValidTerm: false }, options));
  assert.ok(explainedTermProblem({ ...result, cefrLevel: 'unknown' }, options));
  assert.ok(explainedTermProblem({ ...result, meaningZh: '' }, options));
});
