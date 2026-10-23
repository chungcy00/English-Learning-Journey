import type { VocabularyItem } from '../types';
import { READING_LEVELS } from './readingLevelDistribution';
export type HistoryVocabularyLevel = typeof READING_LEVELS[number];
export interface HistoryReviewRequest {
  source: 'history'; level: HistoryVocabularyLevel | null; mode: 'due' | 'free'; ids: string[];
}
export function vocabularyLevel(item: Pick<VocabularyItem, 'cefrLevel'>): HistoryVocabularyLevel {
  return READING_LEVELS.includes(item.cefrLevel as HistoryVocabularyLevel) ? item.cefrLevel as HistoryVocabularyLevel : '未知';
}
export function vocabularyForLevel(items: readonly VocabularyItem[], level: HistoryVocabularyLevel | null) {
  return items.filter(item => level === null || vocabularyLevel(item) === level);
}
export function dueVocabulary(items: readonly VocabularyItem[], now: number) {
  return items.filter(item => Number.isFinite(item.nextReviewDate) && item.nextReviewDate <= now);
}
export function vocabularyTask(items: readonly VocabularyItem[], level: HistoryVocabularyLevel | null, now: number) {
  const words = vocabularyForLevel(items, level);
  const mastered = words.filter(item => item.status === 'Mastered').length;
  return { level, words, total: words.length, due: dueVocabulary(words, now).length, mastered,
    percentage: words.length ? mastered / words.length * 100 : 0,
    recent: [...words].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5) };
}
export function createHistoryReviewRequest(items: readonly VocabularyItem[], level: HistoryVocabularyLevel | null, now: number): HistoryReviewRequest | null {
  const words = vocabularyForLevel(items, level);
  if (!words.length) return null;
  const due = dueVocabulary(words, now);
  return { source: 'history', level, mode: due.length ? 'due' : 'free', ids: (due.length ? due : words).map(item => item.id) };
}
export function historyReviewWords(items: readonly VocabularyItem[], request: HistoryReviewRequest) {
  const available = new Map(vocabularyForLevel(items, request.level).map(item => [item.id, item]));
  return request.ids.flatMap(id => available.has(id) ? [available.get(id)!] : []);
}
export const vocabularyLevelLabel = (level: string) => level === '未知' ? '未标注' : level;
