import type { VocabularyItem } from '../types';
import { READING_LEVELS } from './readingLevelDistribution';
export type HistoryVocabularyLevel = typeof READING_LEVELS[number];
export type HistoryReviewRequest = { source: 'history'; level: HistoryVocabularyLevel | null; ids: string[] };
export function vocabularyLevel(item: Pick<VocabularyItem, 'cefrLevel'>): HistoryVocabularyLevel {
  return READING_LEVELS.includes(item.cefrLevel as HistoryVocabularyLevel) ? item.cefrLevel as HistoryVocabularyLevel : '未知';
}
export function vocabularyForLevel(items: readonly VocabularyItem[], level: HistoryVocabularyLevel | null) {
  return items.filter(item => level === null || vocabularyLevel(item) === level);
}
export function vocabularyTask(items: readonly VocabularyItem[], level: HistoryVocabularyLevel | null) {
  const words = vocabularyForLevel(items, level);
  return { level, words, total: words.length, recent: [...words].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5) };
}
export function createHistoryReviewRequest(items: readonly VocabularyItem[], level: HistoryVocabularyLevel | null): HistoryReviewRequest | null {
  const words = vocabularyForLevel(items, level);
  return words.length ? { source: 'history', level, ids: words.map(item => item.id) } : null;
}
export function historyReviewWords(items: readonly VocabularyItem[], request: HistoryReviewRequest) {
  const available = new Map(vocabularyForLevel(items, request.level).map(item => [item.id, item]));
  return request.ids.flatMap(id => available.has(id) ? [available.get(id)!] : []);
}
export const vocabularyLevelLabel = (level: string) => level === '未知' ? '未标注' : level;
