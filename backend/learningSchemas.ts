import { Type } from '@google/genai';
import { DETAIL_SECTIONS, VOCABULARY_CATEGORIES, type VocabularyDetails, type LearningEntry } from '../src/types.js';
import { vocabularyKey } from '../src/utils/vocabularyDetails.js';
const string = { type: Type.STRING };
const entries = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
  text: string, meaningZh: string, partOfSpeech: string, example: string, exampleTranslation: string, note: string, category: string, senseId: string,
}, required: ['text', 'meaningZh'] } };
export const detailsSchema = { type: Type.OBJECT, properties: {
  isValidTerm: { type: Type.BOOLEAN }, term: string,
  type: { type: Type.STRING, enum: ['word', 'phrase', 'idiom'] }, category: { type: Type.STRING, enum: [...VOCABULARY_CATEGORIES] }, phoneticUK: string, phoneticUS: string,
  senses: entries, inflections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: string, value: string }, required: ['label', 'value'] } },
  sections: { type: Type.OBJECT, properties: Object.fromEntries(DETAIL_SECTIONS.map(key => [key, entries])), required: [...DETAIL_SECTIONS] },
}, required: ['isValidTerm', 'term', 'type', 'category', 'phoneticUK', 'phoneticUS', 'senses', 'inflections', 'sections'] };
export const paragraphSchema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { source: string, translation: string }, required: ['source', 'translation'] } };
export function validateDetails(data: any, term: string, type: VocabularyDetails['type'], retainedSenses: LearningEntry[] = []): VocabularyDetails {
  if (data?.isValidTerm !== true || data.term !== term || !Array.isArray(data.senses) || !data.senses.length) throw new Error('未找到可靠的词条资料，请检查拼写，或先手动保存。');
  const normalize = (items: any[], prefix: string) => {
    if (!Array.isArray(items) || items.length > 16) throw new Error('词条资料结构不完整，请重试。');
    return items.map((item, i) => {
      if (!item || typeof item.text !== 'string' || !item.text.trim() || typeof item.meaningZh !== 'string') throw new Error('词条资料结构不完整，请重试。');
      return { ...Object.fromEntries(['text','meaningZh','partOfSpeech','example','exampleTranslation','note','category','senseId'].map(k => [k, typeof item[k] === 'string' ? item[k].slice(0, 3000) : ''])), text: item.text, meaningZh: item.meaningZh, id: crypto.randomUUID() };
    });
  };
  const senses = normalize(data.senses, 'sense').map((sense, index) => {
    const retained = retainedSenses.find(item => item.id === data.senses[index].senseId);
    return retained ? { ...sense, id: retained.id } : sense;
  });
  const senseIds = new Map(data.senses.map((sense: any, index: number) => [sense.senseId || '', senses[index].id]));
  const sections = Object.fromEntries(DETAIL_SECTIONS.map(key => [key, normalize(data.sections?.[key], key)])) as VocabularyDetails['sections'];
  for (const entries of Object.values(sections)) for (const entry of entries) entry.senseId = entry.senseId ? String(senseIds.get(entry.senseId) || '') : '';
  if (!Array.isArray(data.inflections) || data.inflections.some((v: any) => typeof v?.label !== 'string' || typeof v?.value !== 'string') || typeof data.phoneticUK !== 'string' || typeof data.phoneticUS !== 'string') throw new Error('词条资料结构不完整，请重试。');
  const category = VOCABULARY_CATEGORIES.includes(data.category) ? data.category : data.type === 'idiom' ? 'idiom' : type;
  const resolvedType = type === 'word' ? 'word' : category === 'idiom' ? 'idiom' : 'phrase';
  return { key: vocabularyKey(term, type), term, type: resolvedType, category, phoneticUK: data.phoneticUK, phoneticUS: data.phoneticUS, senses, inflections: category === 'word' ? data.inflections : [], sections, generated: true, generatedSections: [...DETAIL_SECTIONS], provenance: {}, updatedAt: Date.now() };
}
