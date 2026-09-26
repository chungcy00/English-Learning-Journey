import type { CEFRLevel, ReadingRecord, VocabularyItem } from '../types';
import { normalizeEnglishTerm } from './englishSearch';

const englishCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function isVocabularyAtLevel(item: VocabularyItem, level: CEFRLevel, readings: ReadonlyMap<string, ReadingRecord>): boolean {
  const sourceLevel = item.sourceCefrLevel ||
    (item.sourceReadingId ? readings.get(item.sourceReadingId)?.cefrLevel : undefined);
  return sourceLevel === level || !!item.wordbookLevels?.includes(level);
}

export function compareWordbookEntries(
  a: VocabularyItem,
  b: VocabularyItem,
  currentCefr: CEFRLevel,
  readings: ReadonlyMap<string, ReadingRecord>,
): number {
  const levelPriority = Number(isVocabularyAtLevel(b, currentCefr, readings)) - Number(isVocabularyAtLevel(a, currentCefr, readings));

  // Treat words, phrases and idioms as whole English entries, independent of update time.
  return levelPriority || englishCollator.compare(
    normalizeEnglishTerm(a.term), normalizeEnglishTerm(b.term),
  ) || a.id.localeCompare(b.id);
}
