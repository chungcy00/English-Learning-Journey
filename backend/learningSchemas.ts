import { Type } from '@google/genai';
import { DETAIL_SECTIONS, VOCABULARY_CATEGORIES, type VocabularyDetails, type LearningEntry } from '../src/types.js';
import { inflectionLabel, vocabularyKey } from '../src/utils/vocabularyDetails.js';
export class VocabularyDetailsError extends Error { name = 'VocabularyDetailsError'; }
const string = { type: Type.STRING };
const entries = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
  text: string, meaningZh: string, partOfSpeech: string, example: string, exampleTranslation: string, note: string, category: string, senseId: string,
}, required: ['text', 'meaningZh'] } };
const family = { type: Type.OBJECT, properties: { base: string, relation: string }, required: ['base', 'relation'] };
const morphology = { type: Type.OBJECT, properties: {
  root: string, meaningZh: string,
  parts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { kind: { type: Type.STRING, enum: ['prefix', 'root', 'suffix'] }, text: string, meaningZh: string }, required: ['kind', 'text', 'meaningZh'] } },
  explanation: string, mnemonic: string,
  related: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { word: string, partOfSpeech: string, meaningZh: string }, required: ['word', 'partOfSpeech', 'meaningZh'] } },
}, required: ['root', 'meaningZh', 'parts', 'explanation', 'mnemonic', 'related'] };
const derivativeEntries = { ...entries, items: { ...entries.items, properties: { ...entries.items.properties, family }, required: ['text', 'meaningZh', 'partOfSpeech', 'family'] } };
const rootEntries = { ...entries, items: { ...entries.items, properties: { ...entries.items.properties, morphology }, required: ['text', 'meaningZh', 'morphology'] } };
const phraseEntries = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: string, meaningZh: string, category: string, example: string, exampleTranslation: string, note: string }, required: ['text', 'meaningZh'] } };
const usageEntries = { ...entries, items: { ...entries.items, properties: { ...entries.items.properties,
  usageKind: { type: Type.STRING, enum: ['scenario','grammar','comparison','error','register','natural'] },
  contrast: { type: Type.OBJECT, properties: { incorrect: string, correct: string }, required: ['incorrect','correct'] },
}, required: ['text','meaningZh','usageKind'] } };
export const detailsSchema = { type: Type.OBJECT, properties: {
  isValidTerm: { type: Type.BOOLEAN }, term: string,
  type: { type: Type.STRING, enum: ['word', 'phrase', 'idiom'] }, category: { type: Type.STRING, enum: [...VOCABULARY_CATEGORIES] }, phoneticUK: string, phoneticUS: string,
  senses: entries, inflections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: string, value: string }, required: ['label', 'value'] } },
  sections: { type: Type.OBJECT, properties: Object.fromEntries(DETAIL_SECTIONS.map(key => [key, key === 'derivatives' ? derivativeEntries : key === 'roots' ? rootEntries : key === 'phrases' ? phraseEntries : key === 'usage' ? usageEntries : entries])), required: [...DETAIL_SECTIONS] },
}, required: ['isValidTerm', 'term', 'type', 'category', 'phoneticUK', 'phoneticUS', 'senses', 'inflections', 'sections'] };
export const paragraphSchema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { source: string, translation: string }, required: ['source', 'translation'] } };
export function validateDetails(data: any, term: string, type: VocabularyDetails['type'], retainedSenses: LearningEntry[] = [], requireStructured = false): VocabularyDetails {
  if (data?.isValidTerm !== true || data.term !== term || !Array.isArray(data.senses) || !data.senses.length) throw new VocabularyDetailsError('未找到可靠的词条资料，请检查拼写，或先手动保存。');
  const normalize = (items: any[], prefix: string) => {
    if (!Array.isArray(items) || items.length > 16) throw new VocabularyDetailsError('词条资料结构不完整，请重试。');
    return items.map((item, i) => {
      if (!item || typeof item.text !== 'string' || !item.text.trim() || typeof item.meaningZh !== 'string') throw new VocabularyDetailsError('词条资料结构不完整，请重试。');
      const entry: LearningEntry = { ...Object.fromEntries(['text','meaningZh','partOfSpeech','example','exampleTranslation','note','category','senseId'].map(k => [k, typeof item[k] === 'string' ? item[k].slice(0, 3000) : ''])), text: item.text, meaningZh: item.meaningZh, id: crypto.randomUUID() };
      const shortText = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 3000;
      if (prefix === 'derivatives' && (item.family !== undefined || requireStructured)) {
        if (!shortText(item.family?.base) || !shortText(item.family?.relation) || !shortText(item.partOfSpeech)) throw new VocabularyDetailsError('派生词构词关系不完整，请重试。');
        entry.family = { base: item.family.base.trim(), relation: item.family.relation.trim() };
      }
      if (prefix === 'roots' && (item.morphology !== undefined || requireStructured)) {
        const m = item.morphology;
        // Dictionaries may mark bound affixes with a hyphen. Remove that notation
        // only when doing so reconstructs the original word exactly.
        if (Array.isArray(m?.parts) && m.parts.every((part: any) => typeof part?.text === 'string')) {
          const plain = m.parts.map((part: any) => ({ ...part, text: part.text.replace(/^-+|-+$/g, '') }));
          if (m.parts.map((part: any) => part.text).join('').toLowerCase() !== term.toLowerCase() && plain.map((part: any) => part.text).join('').toLowerCase() === term.toLowerCase()) m.parts = plain;
        }
        if (!m || !['root','meaningZh','explanation'].every(key => shortText(m[key])) || typeof m.mnemonic !== 'string' || m.mnemonic.length > 3000 || !Array.isArray(m.parts) || !m.parts.length || m.parts.length > 8
          || m.parts.some((part: any) => !['prefix','root','suffix'].includes(part?.kind) || !shortText(part.text) || !shortText(part.meaningZh))
          || !m.parts.some((part: any) => part.kind === 'root') || m.parts.map((part: any) => part.text).join('').toLowerCase() !== term.toLowerCase()
          || !Array.isArray(m.related) || m.related.length > 4 || m.related.some((word: any) => !['word','partOfSpeech','meaningZh'].every(key => shortText(word?.[key])))) throw new VocabularyDetailsError('构词拆解不完整或与原词不符，请重试。');
        entry.morphology = { root: m.root, meaningZh: m.meaningZh, parts: m.parts.map(({kind,text,meaningZh}: any) => ({kind,text,meaningZh})), explanation: m.explanation, mnemonic: m.mnemonic,
          related: m.related.map(({word,partOfSpeech,meaningZh}: any) => ({word,partOfSpeech,meaningZh})) };
      }
      if (prefix === 'usage' && (item.usageKind !== undefined || requireStructured)) {
        if (!['scenario','grammar','comparison','error','register','natural'].includes(item.usageKind)) throw new VocabularyDetailsError('用法辨析类型不受支持，请重试。');
        entry.usageKind = item.usageKind;
      }
      if (prefix === 'usage' && item.contrast != null && !(item.contrast.incorrect === '' && item.contrast.correct === '')) {
        if (item.usageKind !== 'error' || !shortText(item.contrast?.incorrect) || !shortText(item.contrast?.correct) || item.contrast.incorrect.trim() === item.contrast.correct.trim()) throw new VocabularyDetailsError('用法纠错内容不完整，请重试。');
        entry.contrast = { incorrect: item.contrast.incorrect, correct: item.contrast.correct };
      }
      return entry;
    });
  };
  const senses = normalize(data.senses, 'sense').map((sense, index) => {
    const retained = retainedSenses.find(item => item.id === data.senses[index].senseId);
    return retained ? { ...sense, id: retained.id } : sense;
  });
  const senseIds = new Map(data.senses.map((sense: any, index: number) => [sense.senseId || '', senses[index].id]));
  const sections = Object.fromEntries(DETAIL_SECTIONS.map(key => [key, normalize(data.sections?.[key], key)])) as VocabularyDetails['sections'];
  for (const entries of Object.values(sections)) for (const entry of entries) entry.senseId = entry.senseId ? String(senseIds.get(entry.senseId) || '') : '';
  if (!Array.isArray(data.inflections) || data.inflections.some((v: any) => typeof v?.label !== 'string' || typeof v?.value !== 'string') || typeof data.phoneticUK !== 'string' || typeof data.phoneticUS !== 'string') throw new VocabularyDetailsError('词条资料结构不完整，请重试。');
  // Do not repeat ordinary inflections or the queried headword in the derivational family.
  const excluded = new Set([term, ...data.inflections.map((form: any) => form.value)].map(value => value.toLowerCase().trim()));
  const seen = new Set<string>();
  sections.derivatives = sections.derivatives.filter(entry => {
    const key = entry.text.toLowerCase().trim();
    if (excluded.has(key) || seen.has(key)) return false;
    seen.add(key); return true;
  });
  const category = VOCABULARY_CATEGORIES.includes(data.category) ? data.category : data.type === 'idiom' ? 'idiom' : type;
  const resolvedType = type === 'word' ? 'word' : category === 'idiom' ? 'idiom' : 'phrase';
  return { key: vocabularyKey(term, type), term, type: resolvedType, category, phoneticUK: data.phoneticUK, phoneticUS: data.phoneticUS, senses, inflections: category === 'word' ? data.inflections.map((form: any) => ({ label: inflectionLabel(form.label), value: form.value })) : [], sections, generated: true, generatedSections: [...DETAIL_SECTIONS], provenance: {}, updatedAt: Date.now() };
}
