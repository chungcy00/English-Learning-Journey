import {migrateReviewedUsage} from './usageMigration';
import { db } from '../db/dexie';
import type { DetailSection, VocabularyDetails, VocabularyItem, SavedMaterial, LearningEntry } from '../types';
import { legacyDetails, mergeGeneratedDetails, vocabularyKey, materialKey } from '../utils/vocabularyDetails';

export const notifyVocabularyChange = () => window.dispatchEvent(new Event('vocabulary-data-changed'));
export async function readVocabularyDetails(vocab: VocabularyItem) {
  await migrateReviewedUsage();
  return db.transaction('rw', db.vocabularyDetails, async () => {
    const key = vocabularyKey(vocab.term, vocab.type);
    const existing = await db.vocabularyDetails.get(key);
    if (existing) return existing;
    const baseline = legacyDetails(vocab);
    await db.vocabularyDetails.put(baseline);
    return baseline;
  });
}
export async function saveVocabularyDetails(details: VocabularyDetails) {
  await db.transaction('rw', db.vocabularyDetails, db.vocabulary, async () => {
    await db.vocabularyDetails.put(details);
    const words = await db.vocabulary.toArray();
    for (const word of words.filter(word => vocabularyKey(word.term, word.type) === details.key)) {
      // Update learning content only; leave review scheduling and identity intact.
      await db.vocabulary.update(word.id, { details, type: details.type, category: details.category, phonetic: details.phoneticUK || details.phoneticUS,
        meaningZh: details.senses.map(sense => sense.meaningZh || sense.text).join('；'), partOfSpeech: [...new Set(details.senses.map(sense => sense.partOfSpeech).filter(Boolean))].join(' / '),
        definitionEn: details.sections.definitions.map(item => item.text).join('\n'), example: details.sections.examples[0]?.text || word.example,
        collocations: details.sections.phrases.map(item => item.text), translations: { ...word.translations, 'zh-CN': { meaning: details.senses.map(sense => sense.meaningZh || sense.text).join('；'), exampleTranslation: details.sections.examples[0]?.meaningZh || '' } }, updatedAt: details.updatedAt });
    }
  });
  notifyVocabularyChange();
}
const pending = new Map<string, Promise<VocabularyDetails>>();
export async function generateVocabularyDetails(vocab: VocabularyItem, section?: DetailSection, replaceEdited = false) {
  const key = vocabularyKey(vocab.term, vocab.type);
  if (pending.has(key)) return pending.get(key)!;
  const operation = (async () => {
    const existing = await readVocabularyDetails(vocab);
    if (!section && existing.generated) return existing;
    const response = await fetch('/api/vocabulary/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term: vocab.term, entryType: vocab.type, currentInflections: existing.inflections, currentSenses: existing.senses.map(({ id, text, meaningZh, partOfSpeech }) => ({ id, text, meaningZh, partOfSpeech: partOfSpeech || '' })), ...(section ? { section } : {}) }), signal: AbortSignal.timeout(60_000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '资料生成失败，请稍后重试。');
    const latest = await readVocabularyDetails(vocab);
    // Re-read after the request so edits made in another view are retained.
    const merged = mergeGeneratedDetails(latest, data, section, replaceEdited);
    await saveVocabularyDetails(merged);
    return merged;
  })();
  pending.set(key, operation);
  try { return await operation; } finally { pending.delete(key); }
}
export async function toggleMaterial(vocab: VocabularyItem, section: DetailSection, entry: LearningEntry) {
  const type = section === 'examples' ? 'example' : 'phrase';
  const key = materialKey(type, entry.text);
  await db.transaction('rw', db.savedMaterials, db.vocabulary, db.readings, db.vocabularyDetails, async () => {
    const existing = await db.savedMaterials.where('key').equals(key).first();
    if (existing) { await db.savedMaterials.delete(existing.id); return; }
    const words = await db.vocabulary.toArray();
    const savedWord = words.find(word => vocabularyKey(word.term, word.type) === vocabularyKey(vocab.term, vocab.type));
    const sourceExists = vocab.sourceReadingId ? await db.readings.get(vocab.sourceReadingId) : undefined;
    const now = Date.now();
    const details = await db.vocabularyDetails.get(vocabularyKey(vocab.term, vocab.type));
    const material: SavedMaterial = { id: crypto.randomUUID(), key, type, text: entry.text, translation: entry.meaningZh, note: entry.note || '',
      vocabularyId: savedWord?.id, sourceReadingId: sourceExists?.id, sourceSection: section, sourceEntryId: entry.id,
      source: details?.provenance[section]?.source || 'ai', createdAt: now, updatedAt: now };
    await db.savedMaterials.add(material);
  });
  notifyVocabularyChange();
}
