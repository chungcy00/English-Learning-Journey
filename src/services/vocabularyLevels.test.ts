import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { db } from '../db/dexie';
import { basicVocabulary, legacyDetails, mergeGeneratedDetails } from '../utils/vocabularyDetails';
import { ensureVocabularyLevels } from './vocabularyLevels';

const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
beforeEach(async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  await db.delete(); await db.open();
});
afterEach(async () => {
  globalThis.fetch = originalFetch;
  await db.delete();
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

test('old cached levels are restored, missing custom levels assessed, existing levels retained', async () => {
  const cached = basicVocabulary('gist');
  const details = { ...legacyDetails(cached), cefrLevel: 'C1' as const };
  const missing = { ...basicVocabulary('conflict'), meaningZh: '冲突', reviewCount: 7, nextReviewDate: 777 };
  const known = { ...basicVocabulary('familiar'), cefrLevel: 'B1' as const };
  await db.vocabulary.bulkPut([cached, missing, known]); await db.vocabularyDetails.put(details);
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const { items } = JSON.parse(options!.body as string);
    assert.deepEqual(items.map((item: any) => item.id), [missing.id]);
    return Response.json({ levels: [{ id: missing.id, level: 'B2' }] });
  };
  await ensureVocabularyLevels(); await ensureVocabularyLevels();
  assert.equal(calls, 1);
  assert.equal((await db.vocabulary.get(cached.id))?.cefrLevel, 'C1');
  assert.equal((await db.vocabulary.get(known.id))?.cefrLevel, 'B1');
  const saved = (await db.vocabulary.get(missing.id))!;
  assert.equal(saved.cefrLevel, 'B2');assert.equal(saved.reviewCount, 7);assert.equal(saved.nextReviewDate, 777);
  assert.equal(saved.meaningZh, '冲突');
});

test('unknown is cached only after a valid assessment, and deleted words are not recreated', async () => {
  const unknown = basicVocabulary('zzterm'); const removed = basicVocabulary('remove');
  await db.vocabulary.bulkPut([unknown, removed]);
  globalThis.fetch = async () => {
    await db.vocabulary.delete(removed.id);
    return Response.json({ levels: [{ id: unknown.id, level: 'unknown' }, { id: removed.id, level: 'A2' }] });
  };
  await ensureVocabularyLevels();
  assert.equal((await db.vocabulary.get(unknown.id))?.cefrLevel, undefined);
  assert.ok((await db.vocabulary.get(unknown.id))?.cefrAssessedAt);
  assert.equal(await db.vocabulary.get(removed.id), undefined);
});

test('provider failures never mark unassessed words as completed', async () => {
  const word = basicVocabulary('retry'); await db.vocabulary.put(word);
  globalThis.fetch = async () => new Response('', { status: 503 });
  await ensureVocabularyLevels();
  assert.equal((await db.vocabulary.get(word.id))?.cefrAssessedAt, undefined);
});

test('future detail generation carries its level into the saved details while retaining an existing level', () => {
  const original = legacyDetails(basicVocabulary('considerate'));
  const generated = { ...original, cefrLevel: 'B2' as const };
  assert.equal(mergeGeneratedDetails(original, generated).cefrLevel, 'B2');
  assert.equal(mergeGeneratedDetails({ ...original, cefrLevel: 'C1' }, generated).cefrLevel, 'C1');
});
