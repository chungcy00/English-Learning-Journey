import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CEFRLevel, ReadingRecord, VocabularyItem } from '../types';
import { getVocabularySearchRank } from './englishSearch';
import { compareWordbookEntries, isVocabularyAtLevel } from './wordbookSort';

const entry = (term: string, sourceCefrLevel?: CEFRLevel, updatedAt = 0) => ({
  id: term, term, sourceCefrLevel, updatedAt,
} as VocabularyItem);

test('default view excludes other and unknown levels; explicit additions apply only to chosen levels', () => {
  const added = { ...entry('break the ice', 'B2'), wordbookLevels: ['B1'] as CEFRLevel[] };
  assert.equal(isVocabularyAtLevel(entry('advanced', 'C1'), 'B1', new Map()), false);
  assert.equal(isVocabularyAtLevel(entry('unknown'), 'B1', new Map()), false);
  assert.equal(isVocabularyAtLevel(added, 'B1', new Map()), true);
  assert.equal(isVocabularyAtLevel(added, 'A2', new Map()), false);
  assert.equal(isVocabularyAtLevel(added, 'B2', new Map()), true);
});

test('each selected CEFR level comes first, regardless of update time', () => {
  const levels: CEFRLevel[] = ['A2', 'B1', 'B2', 'C1'];
  const entries = levels.map((level, index) => entry(`term ${index}`, level, index));
  for (const level of levels) {
    const sorted = [...entries].sort((a, b) => compareWordbookEntries(a, b, level, new Map()));
    assert.equal(sorted[0].sourceCefrLevel, level);
    assert.equal(sorted.length, entries.length);
  }
});

test('words, phrases and idioms sort as complete English entries ignoring case and spaces', () => {
  const entries = [entry('undivided attention', 'B1', 100), entry(' GENUINE ', 'B1', 200),
    entry('break the ice', 'B1', 0), entry('considerate', 'B1', 500)];
  assert.deepEqual(entries.sort((a, b) => compareWordbookEntries(a, b, 'B1', new Map()))
    .map((item) => item.term), ['break the ice', 'considerate', ' GENUINE ', 'undivided attention']);
});

test('legacy records use the source reading; saved levels work without history', () => {
  const legacy = { ...entry('zebra'), sourceReadingId: 'reading' };
  const source = new Map([['reading', { cefrLevel: 'B1' } as ReadingRecord]]);
  assert.ok(compareWordbookEntries(legacy, entry('apple', 'A2'), 'B1', source) < 0);
  assert.ok(compareWordbookEntries(entry('zebra', 'B1'), entry('apple'), 'B1', new Map()) < 0);
});

test('exact English matches stay ahead of matching-level definition and phrase matches', () => {
  const entries = [entry('break the ice', 'B1'),
    { ...entry('frozen', 'B1'), definitionEn: 'covered in ice' }, entry('ice', 'B2')];
  const ranked = entries.map(item => ({ item, rank: getVocabularySearchRank(item, ' ICE ')! }))
    .sort((a, b) => a.rank - b.rank || compareWordbookEntries(a.item, b.item, 'B1', new Map()));
  assert.deepEqual(ranked.map(({ item }) => item.term), ['ice', 'break the ice', 'frozen']);
});
