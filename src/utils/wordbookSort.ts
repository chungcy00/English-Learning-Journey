import type { CEFRLevel, ReadingRecord, VocabularyItem } from '../types';
import { normalizeEnglishTerm } from './englishSearch';

const englishCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function compareWordbookEntries(
  a: VocabularyItem,
  b: VocabularyItem,
  currentCefr: CEFRLevel,
  readings: ReadonlyMap<string, ReadingRecord>,
): number {
  const levelOf = (item: VocabularyItem) => item.sourceCefrLevel ||
    (item.sourceReadingId ? readings.get(item.sourceReadingId)?.cefrLevel : undefined);
  const levelPriority = Number(levelOf(b) === currentCefr) - Number(levelOf(a) === currentCefr);

  // Treat words, phrases and idioms as whole English entries, independent of update time.
  return levelPriority || englishCollator.compare(
    normalizeEnglishTerm(a.term), normalizeEnglishTerm(b.term),
  ) || a.id.localeCompare(b.id);
}
