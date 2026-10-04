import type { ReadingRecord, VocabularyItem } from '../types';
import { normalizeEnglishTerm } from './englishSearch';

export function replaceReadingTerm(reading: ReadingRecord, item: VocabularyItem, replaceId?: string): ReadingRecord {
  const limit = reading.vocabularyCount || reading.selectedVocabulary.length;
  if (item.cefrLevel !== reading.cefrLevel) throw new Error(`只可加入 ${reading.cefrLevel} 程度的表达。`);
  if (reading.selectedVocabulary.some(v => normalizeEnglishTerm(v.term) === normalizeEnglishTerm(item.term))) throw new Error('这个表达已在精选词汇中。');
  if (replaceId && !reading.selectedVocabulary.some(v => v.id === replaceId)) throw new Error('待替换词条已变化，请重新选择。');
  if (!replaceId && reading.selectedVocabulary.length >= limit) throw new Error(`精选词汇上限为 ${limit} 项，请先选择要替换的词条。`);
  const vocabulary = replaceId ? reading.selectedVocabulary.map(v => v.id === replaceId ? item : v) : [...reading.selectedVocabulary, item];
  const terms = new Set(vocabulary.map(v => normalizeEnglishTerm(v.term)));
  const translations = reading.translations && Object.fromEntries(Object.entries(reading.translations).map(([language, translation]) => {
    const { vocabularyTranslations: _vocabulary, exerciseTranslations: _exercises, ...readingOnly } = translation;
    return [language, readingOnly];
  }));
  return { ...reading, vocabularyCount: limit, selectedVocabulary: vocabulary,
    // Do not leave exercises testing a removed target. No fabricated answers.
    rewritePractice: reading.rewritePractice.filter(p => terms.has(normalizeEnglishTerm(p.target))),
    translations,
    updatedAt: Date.now() };
}

export function planReadingVocabularySync(previous: ReadingRecord | undefined, reading: ReadingRecord, saved: VocabularyItem[], allReadings: ReadingRecord[]) {
  const nextTerms = new Set(reading.selectedVocabulary.map(v => normalizeEnglishTerm(v.term)));
  const oldTerms = new Set(previous?.selectedVocabulary.map(v => normalizeEnglishTerm(v.term)) || []);
  const otherTerms = new Set(allReadings.filter(r => r.id !== reading.id).flatMap(r => r.selectedVocabulary.map(v => normalizeEnglishTerm(v.term))));
  const removeIds = saved.filter(v => oldTerms.has(normalizeEnglishTerm(v.term)) && !nextTerms.has(normalizeEnglishTerm(v.term)) &&
    v.sourceReadingId === reading.id && !v.savedManually && !v.wordbookLevels?.length && !otherTerms.has(normalizeEnglishTerm(v.term))).map(v => v.id);
  const upserts = reading.selectedVocabulary.map(v => {
    const existing = saved.find(s => normalizeEnglishTerm(s.term) === normalizeEnglishTerm(v.term));
    // Reusing a term must never erase its ID, review progress or manual ownership.
    return existing ? {
      ...existing, ...v, id: existing.id,
      status: existing.status, createdAt: existing.createdAt, updatedAt: existing.updatedAt,
      nextReviewDate: existing.nextReviewDate, lastReviewedAt: existing.lastReviewedAt,
      reviewCount: existing.reviewCount, currentInterval: existing.currentInterval,
      lastRating: existing.lastRating, savedManually: existing.savedManually,
      wordbookLevels: existing.wordbookLevels, translations: existing.translations,
      addedFromReadingIds: existing.addedFromReadingIds,
      cefrLevel: v.cefrLevel || existing.cefrLevel,
    } : { ...v, sourceReadingId: reading.id, sourceCefrLevel: reading.cefrLevel };
  });
  return { removeIds, upserts };
}
