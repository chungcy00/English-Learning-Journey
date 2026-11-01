import type { ReadingRecord, VocabularyItem } from '../types';
import { normalizeEnglishTerm } from './englishSearch';

/** Legacy collections may deduplicate by term while passage copies keep old IDs. */
export function readingVocabularyOwners(items: readonly VocabularyItem[], readings: readonly ReadingRecord[]) {
  const byId = new Map(readings.map(reading => [reading.id, reading]));
  const byTerm = new Map<string, Set<string>>();
  for (const reading of readings) for (const word of reading.selectedVocabulary) {
    const term = normalizeEnglishTerm(word.term);
    if (!byTerm.has(term)) byTerm.set(term, new Set());
    byTerm.get(term)!.add(reading.id);
  }
  return new Map(items.map(word => {
    const ids = new Set([...(word.sourceReadingId ? [word.sourceReadingId] : []),
      ...(word.addedFromReadingIds || []), ...(byTerm.get(normalizeEnglishTerm(word.term)) || [])]);
    return [word.id, [...ids].flatMap(id => byId.has(id) ? [byId.get(id)!] : [])] as const;
  }));
}

export function vocabularyWithReadingSources(items: readonly VocabularyItem[], readings: readonly ReadingRecord[]) {
  const owners = readingVocabularyOwners(items, readings);
  return items.filter(word => owners.get(word.id)!.length > 0);
}

/** Remove only the deleted passage's exclusive words; retain shared scheduling. */
export function planReadingDeletion(id: string, items: readonly VocabularyItem[], readings: readonly ReadingRecord[]) {
  const owners = readingVocabularyOwners(items, readings);
  const removeIds: string[] = [];
  const upserts: VocabularyItem[] = [];
  for (const word of items) {
    const linked = owners.get(word.id)!;
    if (word.sourceReadingId !== id && !word.addedFromReadingIds?.includes(id) && !linked.some(reading => reading.id === id)) continue;
    const remaining = linked.filter(reading => reading.id !== id);
    if (!remaining.length) { removeIds.push(word.id); continue; }
    const primary = remaining.find(reading => reading.id === word.sourceReadingId) || remaining[0];
    upserts.push({ ...word, sourceReadingId: primary.id, sourceCefrLevel: primary.cefrLevel,
      addedFromReadingIds: remaining.map(reading => reading.id) });
  }
  return { removeIds, upserts };
}
