import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createExpressionLoader, EXPRESSION_CACHE_VERSION, preserveCatalogue, validCatalogue } from './expressionCache';
import type { ReadingExpression, ReadingRecord } from '../types';

const reading = { id: 'reading-1', content: 'We helped her out.', title: 'Original' } as ReadingRecord;
const expressions: ReadingExpression[] = [{ term: 'help out', type: 'phrase', cefrLevel: 'B1', contextQuote: 'helped her out' }];

test('concurrent surfaces share one request; a fresh session reuses persisted results without AI', async () => {
  let stored: ReadingRecord = reading;
  let calls = 0;
  const store = {
    read: async () => stored,
    save: async (_id: string, expressionCatalogue: NonNullable<ReadingRecord['expressionCatalogue']>) => { stored = { ...stored, expressionCatalogue }; },
    fetch: async () => { calls++; return expressions; },
  };
  const firstSession = createExpressionLoader(store);
  await Promise.all([firstSession(reading), firstSession(reading), firstSession(reading)]);
  assert.equal(calls, 1);
  assert.deepEqual(await createExpressionLoader(store)(reading), expressions);
  assert.equal(calls, 1);
  await createExpressionLoader(store)({ ...reading, content: 'We can help out tomorrow.' });
  assert.equal(calls, 2);
});

test('old schema invalidates; vocabulary and translation saves preserve fresh catalogue but rewrites invalidate', () => {
  const catalogue = { version: EXPRESSION_CACHE_VERSION, content: reading.content, expressions };
  const previous = { ...reading, expressionCatalogue: catalogue };
  assert.equal(preserveCatalogue({ ...reading, title: 'Translated' }, previous).expressionCatalogue, catalogue);
  assert.equal(preserveCatalogue({ ...previous, content: 'Different text' }, previous).expressionCatalogue, undefined);
  assert.equal(validCatalogue({ ...catalogue, version: 0 }, reading.content), false);
});

test('failed requests do not automatically repeat; explicit retry recovers', async () => {
  let calls = 0;
  const load = createExpressionLoader({ read: async () => undefined, save: async () => {}, fetch: async () => {
    if (++calls === 1) throw new Error('quota exhausted');
    return expressions;
  } });
  await assert.rejects(load(reading));
  await assert.rejects(load(reading));
  assert.equal(calls, 1);
  assert.deepEqual(await load(reading, true), expressions);
  assert.equal(calls, 2);
});

test('unavailable persistence still returns results and malformed catalogue is rejected', async () => {
  const load = createExpressionLoader({ read: async () => { throw new Error('blocked'); }, save: async () => { throw new Error('full'); }, fetch: async () => expressions });
  assert.deepEqual(await load(reading), expressions);
  const broken = createExpressionLoader({ read: async () => undefined, save: async () => {}, fetch: async () => undefined as unknown as ReadingExpression[] });
  await assert.rejects(broken(reading), /词条数据不完整/);
});
