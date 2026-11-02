import type { VocabularyItem, VocabStatus } from '../types';
import { READING_LEVELS } from './readingLevelDistribution';
export type HistoryVocabularyLevel = typeof READING_LEVELS[number];
export type HistoryReviewMode = 'status' | 'free';
export type HistoryReviewRequest = {
  source: 'history'; level: HistoryVocabularyLevel | null; ids: string[];
} & ({ mode: 'free'; status?: never } | { mode: 'status'; status: VocabStatus });
export const HISTORY_REVIEW_STATUSES: readonly { value: VocabStatus; label: string }[] = [
  { value: 'New', label: '未学习' }, { value: 'Learning', label: '学习中' },
  { value: 'Difficult', label: '困难' }, { value: 'Mastered', label: '已掌握' },
];
export const historyStatusLabel = (status: VocabStatus) => HISTORY_REVIEW_STATUSES.find(item => item.value === status)!.label;
export function vocabularyLevel(item: Pick<VocabularyItem, 'cefrLevel'>): HistoryVocabularyLevel {
  return READING_LEVELS.includes(item.cefrLevel as HistoryVocabularyLevel) ? item.cefrLevel as HistoryVocabularyLevel : '未知';
}
export function vocabularyForLevel(items: readonly VocabularyItem[], level: HistoryVocabularyLevel | null) {
  return items.filter(item => level === null || vocabularyLevel(item) === level);
}
export function vocabularyTask(items: readonly VocabularyItem[], level: HistoryVocabularyLevel | null) {
  const words = vocabularyForLevel(items, level);
  const statusCounts: Record<VocabStatus, number> = { New: 0, Learning: 0, Difficult: 0, Mastered: 0 };
  for (const word of words) if (Object.hasOwn(statusCounts, word.status)) statusCounts[word.status]++;
  const mastered = words.filter(item => item.status === 'Mastered').length;
  return { level, words, total: words.length, statusCounts, mastered,
    percentage: words.length ? mastered / words.length * 100 : 0,
    recent: [...words].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5) };
}
export function createHistoryReviewRequest(items: readonly VocabularyItem[], level: HistoryVocabularyLevel | null, mode: HistoryReviewMode = 'free', status?: VocabStatus): HistoryReviewRequest | null {
  const words = vocabularyForLevel(items, level);
  if (mode === 'status' && !status) return null;
  const selected = mode === 'status' ? words.filter(word => word.status === status) : words;
  if (!selected.length) return null;
  const scope = { source: 'history' as const, level, ids: selected.map(item => item.id) };
  return mode === 'status' ? { ...scope, mode, status: status! } : { ...scope, mode };
}
export function historyReviewWords(items: readonly VocabularyItem[], request: HistoryReviewRequest) {
  const available = new Map(vocabularyForLevel(items, request.level).map(item => [item.id, item]));
  return request.ids.flatMap(id => available.has(id) ? [available.get(id)!] : []);
}
export const vocabularyLevelLabel = (level: string) => level === '未知' ? '未标注' : level;
