import type { ReadingRecord } from '../types';
import { splitReadingSentences } from './readingSegments';
export function cachedParagraphTranslation(reading: ReadingRecord, source: string, index: number, blockCount: number): string | undefined {
  const indexed = reading.paragraphTranslations?.[index];
  const exact = indexed?.source.trim() === source.trim() ? indexed : undefined;
  if (exact?.translation.trim()) return exact.translation;
  const legacy = reading.translations?.['zh-CN'];
  const sentences = splitReadingSentences(source).map(text => text.trim()).filter(Boolean);
  const translations = sentences.map(text => legacy?.sentenceTranslations?.find(item => item.source.trim() === text)?.translation);
  if (translations.length && translations.every(Boolean)) return translations.join('');
  const oldBlocks = legacy?.translatedContent?.split(/\n\s*\n/).filter(text => text.trim()) || [];
  // Only reuse legacy paragraph text when boundaries are unambiguous.
  if (reading.readingType !== 'dialogue' && oldBlocks.length === blockCount) return oldBlocks[index];
}
