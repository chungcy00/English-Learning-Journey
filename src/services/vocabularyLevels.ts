import { db } from '../db/dexie';
import type { CEFRLevel, VocabularyItem } from '../types';
import { vocabularyKey } from '../utils/vocabularyDetails';
import { notifyVocabularyChange } from './vocabularyDetails';

const levels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const isVocabularyLevel = (value: unknown): value is CEFRLevel => typeof value === 'string' && levels.has(value);
const attempted = new Set<string>();
let pending: Promise<void> | undefined;
let requested = false;

async function completeLevels() {
  const words = await db.vocabulary.toArray();
  const readings = await db.readings.toArray();
  const cache = new Map((await db.vocabularyDetails.toArray()).map(details => [details.key, details]));
  const missing: VocabularyItem[] = [];
  for (const word of words) {
    if (isVocabularyLevel(word.cefrLevel)) continue;
    const cachedLevel = cache.get(vocabularyKey(word.term, word.type))?.cefrLevel;
    const passageWord = readings.flatMap(reading => reading.selectedVocabulary || []).find(item =>
      vocabularyKey(item.term, item.type) === vocabularyKey(word.term, word.type) && isVocabularyLevel(item.cefrLevel));
    const recovered = [word.details?.cefrLevel, cachedLevel, passageWord?.cefrLevel].find(isVocabularyLevel);
    if (recovered) {
      await storeLevel(word, recovered);
      continue;
    }
    const attemptKey = JSON.stringify([word.id, word.term, word.meaningZh, word.partOfSpeech]);
    if (word.cefrAssessedAt || attempted.has(attemptKey)) continue;
    attempted.add(attemptKey);
    missing.push(word);
  }
  for (let start = 0; start < missing.length; start += 20) {
    const batch = missing.slice(start, start + 20);
    try {
      const response = await fetch('/api/vocabulary/levels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch.map(word => ({ id: word.id, term: word.term,
          meaningZh: (word.meaningZh || '').slice(0, 1000), partOfSpeech: (word.partOfSpeech || '').slice(0, 200) })) }),
        signal: AbortSignal.timeout(55_000),
      });
      if (!response.ok) continue;
      const result = await response.json();
      if (!Array.isArray(result.levels) || result.levels.length !== batch.length ||
        new Set(result.levels.map((item: {id: string}) => item?.id)).size !== batch.length ||
        result.levels.some((item: {id: string; level: string}) => !batch.some(word => word.id === item?.id) ||
          (!isVocabularyLevel(item?.level) && item?.level !== 'unknown'))) continue;
      for (const item of result.levels) {
        await storeLevel(batch.find(word => word.id === item.id)!, isVocabularyLevel(item.level) ? item.level : undefined);
      }
    } catch {
      // Keep unresolved records eligible for another attempt on a later visit.
    }
  }
}

async function storeLevel(snapshot: VocabularyItem, level: CEFRLevel | undefined) {
  const changed = await db.transaction('rw', db.vocabulary, async () => {
    const current = await db.vocabulary.get(snapshot.id);
    if (!current || isVocabularyLevel(current.cefrLevel) || current.term !== snapshot.term ||
      current.meaningZh !== snapshot.meaningZh || current.partOfSpeech !== snapshot.partOfSpeech) return false;
    await db.vocabulary.update(current.id, { cefrLevel: level, cefrAssessedAt: Date.now() });
    return true;
  });
  if (changed) notifyVocabularyChange();
}

/** Backfill old records and newly saved words, serially and only for missing levels. */
export function ensureVocabularyLevels(): Promise<void> {
  requested = true;
  if (!pending) {
    pending = (async () => {
      do {
        requested = false;
        await completeLevels();
      } while (requested);
    })().finally(() => { pending = undefined; });
  }
  return pending;
}
