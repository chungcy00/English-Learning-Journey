import type { ReadingRecord, VocabularyItem } from '../types';
import { getLocalizedExampleTranslation } from './i18n';
import { normalizeEnglishTerm } from './englishSearch';

/** Reading caches may describe a different example for the same word. */
export function wordbookExampleTranslation(vocab: VocabularyItem, reading: ReadingRecord | null) {
  const direct = getLocalizedExampleTranslation(vocab);
  if (direct) return direct;
  if (!vocab.example?.trim() || !reading) return undefined;
  const matching = reading.selectedVocabulary.find(item =>
    normalizeEnglishTerm(item.term) === normalizeEnglishTerm(vocab.term) &&
    item.example?.trim() === vocab.example.trim());
  const translation = reading.translations?.['zh-CN'];
  const vocabularyTranslation = matching ? getLocalizedExampleTranslation(vocab, translation)
    || getLocalizedExampleTranslation(matching, translation) : undefined;
  // Sentence caches carry their source text, so they can also safely serve saved
  // expressions that were not in the passage's original selected vocabulary.
  return vocabularyTranslation || translation?.sentenceTranslations?.find(item =>
    item.source.trim() === vocab.example.trim() && item.translation.trim())?.translation;
}
