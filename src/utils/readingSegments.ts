import type { ReadingTranslation } from '../types';

export function splitReadingSentences(text: string): string[] {
  const segments = Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text), part => part.segment).filter(part => part.trim());
  const sentences: string[] = [];
  for (const segment of segments) {
    const previous = sentences.at(-1);
    if (previous && /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|e\.g|i\.e)\.\s*$/iu.test(previous)) sentences[sentences.length - 1] += segment;
    else sentences.push(segment);
  }
  return sentences;
}

const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim();

// Only exact source mappings are usable. Never align Chinese by punctuation/index.
export function getSentenceTranslation(source: string, translation?: ReadingTranslation): string | undefined {
  const matches = translation?.sentenceTranslations?.filter(item => typeof item.source === 'string' && typeof item.translation === 'string' && normalize(item.source) === normalize(source) && item.translation.trim());
  if (!matches?.length) return undefined;
  const unique = new Set(matches.map(item => item.translation.trim()));
  return unique.size === 1 ? matches[0].translation.trim() : undefined;
}

// A cached mapping may cover several consecutive source sentences. Keep that
// exact span together; never distribute its Chinese text among guessed sentences.
export function groupReadingSentences(sources: string[], translation?: ReadingTranslation): Array<{ source: string; index: number; translation?: string }> {
  const result: Array<{ source: string; index: number; translation?: string }> = [];
  for (let index = 0; index < sources.length;) {
    const single = getSentenceTranslation(sources[index], translation);
    const candidates: Array<{ source: string; end: number; translation: string }> = [];
    if (!single) {
      for (let end = index + 2; end <= sources.length; end++) {
        const source = sources.slice(index, end).map(part => part.trim()).join(' ');
        const mapped = getSentenceTranslation(source, translation);
        if (mapped) candidates.push({ source: sources.slice(index, end).join(''), end, translation: mapped });
      }
    }
    // Competing spans or conflicting duplicate mappings are not safe to infer.
    const candidate = candidates.length === 1 ? candidates[0] : undefined;
    result.push({ source: candidate?.source ?? sources[index], index, translation: single ?? candidate?.translation });
    index = candidate?.end ?? index + 1;
  }
  return result;
}

export function hasCompleteSentenceTranslations(sources: string[], translation?: ReadingTranslation): boolean {
  return sources.length > 0 && groupReadingSentences(sources, translation).every(source => !!source.translation);
}

export function formatAudioTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—:—';
  const whole = Math.floor(seconds);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
