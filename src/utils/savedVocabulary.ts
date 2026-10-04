import type { VocabularyItem } from '../types';
import { normalizeEnglishTerm, getEnglishTermMatchRank } from './englishSearch';

export function filterSavedVocabulary(items: VocabularyItem[], query: string, status: string): VocabularyItem[] {
  return items.filter(item => (status === 'All' || item.status === status) &&
    (!query.trim() || getEnglishTermMatchRank(item.term, query) !== null))
    .sort((a, b) => normalizeEnglishTerm(a.term).localeCompare(normalizeEnglishTerm(b.term), 'en'));
}
