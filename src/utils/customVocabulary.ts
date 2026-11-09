import type { VocabularyItem } from '../types';
/** Explicit manual origin wins; legacy entries qualify only without article associations. */
export function isCustomVocabulary(word: VocabularyItem) {
  return word.origin === 'manual' || (!word.origin && word.savedManually === true && !word.sourceReadingId && !word.addedFromReadingIds?.length);
}
