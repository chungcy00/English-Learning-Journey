import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentReadingSavedVocabulary } from './savedVocabulary';
import { planReadingVocabularySync } from './readingVocabulary';
import type { ReadingRecord, VocabularyItem } from '../types';

const entry = (term: string, fields = {}) => ({ id: term, term, status: 'New', reviewCount: 0, ...fields } as VocabularyItem);
const reading = { id: 'current', selectedVocabulary: [entry('zebra'), entry('Apple')] } as ReadingRecord;
test('current passage scope is alphabetical and includes only saved selected terms and explicitly added expressions', () => {
  const saved = [entry('zebra'), entry('Apple', { sourceReadingId: 'history', reviewCount: 9 }),
    entry('break the ice', { savedManually: true, sourceReadingId: 'current' }), entry('unrelated', { sourceReadingId: 'history' })];
  assert.deepEqual(currentReadingSavedVocabulary(saved, reading).map(item => item.term), ['Apple', 'break the ice', 'zebra']);
  assert.equal(currentReadingSavedVocabulary(saved, reading)[0].reviewCount, 9);
  assert.equal(saved.length, 4, 'history must remain stored');
  assert.deepEqual(currentReadingSavedVocabulary(saved, null), []);
  assert.deepEqual(currentReadingSavedVocabulary([], reading), [], 'unbookmarked selections must not become review candidates');
});
test('a wordbook candidate enters both shared lists only after saving its current reading association', () => {
  const historical = entry('catch up', { sourceReadingId: 'history', savedManually: true, reviewCount: 5 });
  assert.equal(currentReadingSavedVocabulary([historical], reading).length, 0);
  const added = { ...historical, addedFromReadingIds: ['current'] };
  assert.equal(currentReadingSavedVocabulary([added], reading)[0].reviewCount, 5);
  const plan = planReadingVocabularySync(undefined, { ...reading, selectedVocabulary: [entry('catch up')] }, [added], []);
  assert.deepEqual(plan.upserts[0].addedFromReadingIds, ['current']);
});
