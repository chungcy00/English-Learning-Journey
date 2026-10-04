import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateExpressions } from './expressionPolicy';

test('catalogue keeps independent levels and complete expressions with real context evidence', () => {
  const context = 'We helped her out. She broke the ice with a joke.';
  const entry = (term: string, type: string, cefrLevel: string, contextQuote: string) => ({ term, type, cefrLevel, contextQuote, isValidTerm: true });
  const items = validateExpressions({ expressions: [
    entry('we', 'word', 'B1', 'We helped her out.'),
    entry('help out', 'phrase', 'B1', 'We helped her out.'),
    entry('break the ice', 'idiom', 'B2', 'She broke the ice with a joke.'),
    entry('HELP OUT', 'phrase', 'B1', 'We helped her out.'),
    entry('imaginary', 'word', 'C1', 'This is not in the reading.'),
    { ...entry('her out', 'phrase', 'B1', 'We helped her out.'), isValidTerm: false },
    entry('unknown level', 'phrase', 'B9', 'We helped her out.'),
  ] }, context);
  assert.deepEqual(items.map((item: any) => [item.term, item.cefrLevel]), [['we', 'A1'], ['help out', 'B1'], ['break the ice', 'B2']]);
  assert.deepEqual(items.filter((item: any) => item.cefrLevel === 'B1').map((item: any) => item.term), ['help out']);
});
