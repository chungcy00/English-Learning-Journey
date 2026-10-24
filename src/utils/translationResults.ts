import type { ReadingTranslation } from '../types';
import { groupReadingSentences, hasCompleteSentenceTranslations } from './readingSegments.js';
export const normalizeTranslationSource = (source: string) => source.replace(/\s+/gu, ' ').trim();

/** Accept exact requested sentences or contiguous spans within one source turn/paragraph. */
export function sanitizeSentenceTranslations(segments: unknown, blocks: string[], entries: unknown): NonNullable<ReadingTranslation['sentenceTranslations']> {
  if (!Array.isArray(segments) || !Array.isArray(entries)) return [];
  const sources = segments.filter((v): v is string => typeof v === 'string' && !!v.trim());
  const normalizedBlocks = blocks.map(normalizeTranslationSource);
  const allowed = new Map<string, string>();
  for (let start = 0; start < sources.length; start++) {
    for (let end = start + 1; end <= sources.length; end++) {
      const source = sources.slice(start, end).map(v => v.trim()).join(' ');
      const key = normalizeTranslationSource(source);
      if (normalizedBlocks.some(block => block.includes(key))) allowed.set(key, source);
    }
  }
  return entries.flatMap(item => {
    if (!item || typeof item.source !== 'string' || typeof item.translation !== 'string' || !item.translation.trim()) return [];
    const source = allowed.get(normalizeTranslationSource(item.source));
    return source ? [{ source, translation: item.translation.trim() }] : [];
  });
}

/** Keep useful full text and exact mappings even if a provider omits some sentences. */
export function mergeReadingTranslations(existing: ReadingTranslation | undefined, incoming: ReadingTranslation, blocks: string[][], speakers?: readonly (string | null)[]): ReadingTranslation {
  const mappings = new Map<string, { source: string; translation: string }>();
  for (const result of [existing, incoming]) {
    const grouped = new Map<string, Array<{source: string; translation: string}>>();
    for (const entry of result?.sentenceTranslations || []) {
      if (typeof entry.source !== 'string' || typeof entry.translation !== 'string' || !entry.translation.trim()) continue;
      const key = normalizeTranslationSource(entry.source);
      grouped.set(key, [...(grouped.get(key) || []), entry]);
    }
    for (const [key, entries] of grouped) {
      if (new Set(entries.map(item => item.translation.trim())).size === 1) mappings.set(key, entries[0]);
    }
  }
  let sentenceTranslations = [...mappings.values()];
  const complete = (value?: ReadingTranslation) => blocks.length > 0 && blocks.every(block => hasCompleteSentenceTranslations(block, value));
  if (!complete({ ...incoming, sentenceTranslations }) && complete(existing)) sentenceTranslations = existing!.sentenceTranslations!;
  const result: ReadingTranslation = { ...existing, ...incoming,
    title: incoming.title?.trim() ? incoming.title : existing?.title || '',
    translatedContent: incoming.translatedContent?.trim() ? incoming.translatedContent : existing?.translatedContent || '',
    vocabularyTranslations: { ...existing?.vocabularyTranslations, ...incoming.vocabularyTranslations },
    exerciseTranslations: { ...existing?.exerciseTranslations, ...incoming.exerciseTranslations },
    sentenceTranslations };
  if (!result.translatedContent.trim() && complete(result)) {
    result.translatedContent = blocks.map((block, index) => {
      const text = groupReadingSentences(block, result).map(segment => segment.translation!).join(' ');
      return speakers?.[index] ? `${speakers[index]}: ${text}` : text;
    }).join('\n\n');
  }
  return result;
}
