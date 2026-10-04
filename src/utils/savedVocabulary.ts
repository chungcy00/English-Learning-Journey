import type { ReadingRecord, VocabularyItem } from '../types';
import { normalizeEnglishTerm, getEnglishTermMatchRank } from './englishSearch';

export function orderSavedVocabulary(items: VocabularyItem[]): VocabularyItem[] {
  return [...items].sort((a, b) => normalizeEnglishTerm(a.term).localeCompare(normalizeEnglishTerm(b.term), 'en'));
}
export function currentReadingSavedVocabulary(items: VocabularyItem[], reading: ReadingRecord | null): VocabularyItem[] {
  if (!reading) return [];
  const selected = new Set(reading.selectedVocabulary.map(item => normalizeEnglishTerm(item.term)));
  return orderSavedVocabulary(items.filter(item => selected.has(normalizeEnglishTerm(item.term)) ||
    item.addedFromReadingIds?.includes(reading.id) || (item.savedManually && item.sourceReadingId === reading.id)));
}
export function filterSavedVocabulary(items: VocabularyItem[], query: string, status: string): VocabularyItem[] {
  return orderSavedVocabulary(items.filter(item => (status === 'All' || item.status === status) &&
    (!query.trim() || getEnglishTermMatchRank(item.term, query) !== null)));
}
