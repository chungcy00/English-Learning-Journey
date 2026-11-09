import { Type } from '@google/genai';
import { DETAIL_SECTIONS, VOCABULARY_CATEGORIES, type VocabularyDetails, type LearningEntry } from '../src/types.js';
import { inflectionLabel, vocabularyKey } from '../src/utils/vocabularyDetails.js';
export class VocabularyDetailsError extends Error { name = 'VocabularyDetailsError'; }
const string = { type: Type.STRING };
const chinese = { ...string, description: '用简体中文解释，可保留英文单词和构词符号。', pattern: '[㐀-鿿]' };
const optionalChinese = { ...chinese, pattern: '^$|[㐀-鿿]' };
const entries = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
  text: string, meaningZh: string, partOfSpeech: string, example: string, exampleTranslation: string, note: string, category: string, senseId: string,
}, required: ['text', 'meaningZh'] } };
const family = { type: Type.OBJECT, properties: { base: string, relation: { ...chinese, description: '用简体中文解释真实派生步骤。例：helpful + -ly → helpfully，形容词加 -ly 变为副词；不能把 -fully 虚写成这里的单一后缀。' } }, required: ['base', 'relation'] };
const morphology = { type: Type.OBJECT, properties: {
  root: string, meaningZh: chinese,
  parts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { kind: { type: Type.STRING, enum: ['prefix', 'root', 'suffix'] }, text: string, meaningZh: chinese }, required: ['kind', 'text', 'meaningZh'] } },
  explanation: { ...chinese, description: '用简体中文说明各部分如何组合成原词含义，拼写变化也需解释。不能只介绍词源或整段使用英文。' }, mnemonic: { ...optionalChinese, description: '简短自然的中文辅助记忆联想，不冒充真实词源；无合适联想可留空。' },
  related: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { word: string, partOfSpeech: string, meaningZh: chinese }, required: ['word', 'partOfSpeech', 'meaningZh'] } },
}, required: ['root', 'meaningZh', 'parts', 'explanation', 'mnemonic', 'related'] };
const derivativeEntries = { ...entries, description: '只提供通用学习场景下常见、真实的派生词，不以偶见的否定分词或专门术语凑数。若只能想到罕见构词形式，返回空数组。', items: { ...entries.items, properties: { ...entries.items.properties, family }, required: ['text', 'meaningZh', 'partOfSpeech', 'family'] } };
const rootEntries = { ...entries, items: { ...entries.items, properties: { ...entries.items.properties, morphology }, required: ['text', 'meaningZh', 'morphology'] } };
const phraseEntries = { type: Type.ARRAY, description: 'Practical learner-dictionary expressions. Usually 4–8 distinct common expressions if available, at most 10; preserve articles and prepositions. Never pad obscure combinations.', items: { type: Type.OBJECT, properties: { text: { ...string, description: '完整自然的常见英文表达，保留必要冠词、介词和句型结构。' }, meaningZh: chinese, category: string, example: string, exampleTranslation: string, note: string }, required: ['text', 'meaningZh'] } };
const usageEntries = { type: Type.ARRAY, description: 'Useful actual usage explanations, not pronunciation, stress, IPA, definitions or a repeated collocation list. Select only relevant learning points.', items: { type: Type.OBJECT, properties: {
  text: { ...string, description: 'Short Chinese heading about a real usage distinction, sentence pattern, situation or pitfall. NEVER a pronunciation or stress heading.' },
  meaningZh: { ...chinese, description: '用简体中文解释适用场景、真实句型约束或词义区别，不能只翻译词组。讲介词时应区分完整句法结构，不臆造抽象/具体等选择规则。' },
  example: { ...string, description: 'A short natural English sentence illustrating the explanation, if useful.' }, exampleTranslation: string, note: string,
  usageKind: { type: Type.STRING, enum: ['scenario','grammar','comparison','error','register','natural'] },
  contrast: { type: Type.OBJECT, description: 'Omit unless there is a genuine grammatical/lexical error. Never mark a valid register alternative as incorrect.', properties: { incorrect: string, correct: string }, required: ['incorrect','correct'] },
}, required: ['text','meaningZh','usageKind'] } };
export function isPronunciationOnlyUsage(entry: Pick<LearningEntry, 'text' | 'meaningZh'>) {
  return /发音|读音|音标|重音|音节|pronunciation|\bipa\b|word stress|stress (?:change|pattern|shift)|stress.*syllable/i.test(entry.text);
}
export const detailsSchema = { type: Type.OBJECT, properties: {
  isValidTerm: { type: Type.BOOLEAN }, term: string,
  type: { type: Type.STRING, enum: ['word', 'phrase', 'idiom'] }, category: { type: Type.STRING, enum: [...VOCABULARY_CATEGORIES] }, phoneticUK: string, phoneticUS: string,
  senses: entries, inflections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: string, value: string }, required: ['label', 'value'] } },
  sections: { type: Type.OBJECT, properties: Object.fromEntries(DETAIL_SECTIONS.map(key => [key, key === 'derivatives' ? derivativeEntries : key === 'roots' ? rootEntries : key === 'phrases' ? phraseEntries : key === 'usage' ? usageEntries : entries])), required: [...DETAIL_SECTIONS] },
}, required: ['isValidTerm', 'term', 'type', 'category', 'phoneticUK', 'phoneticUS', 'senses', 'inflections', 'sections'] };
export const paragraphSchema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { source: string, translation: string }, required: ['source', 'translation'] } };
export function validateDetails(data: any, term: string, type: VocabularyDetails['type'], retainedSenses: LearningEntry[] = [], requireStructured = false, retainedInflections: { label: string; value: string }[] = []): VocabularyDetails {
  if (data?.isValidTerm !== true || data.term !== term || !Array.isArray(data.senses) || !data.senses.length) throw new VocabularyDetailsError('未找到可靠的词条资料，请检查拼写，或先手动保存。');
  const normalize = (items: any[], prefix: string) => {
    if (!Array.isArray(items) || items.length > 16) throw new VocabularyDetailsError('词条资料结构不完整，请重试。');
    return items.map((item, i) => {
      if (!item || typeof item.text !== 'string' || !item.text.trim() || typeof item.meaningZh !== 'string') throw new VocabularyDetailsError('词条资料结构不完整，请重试。');
      const entry: LearningEntry = { ...Object.fromEntries(['text','meaningZh','partOfSpeech','example','exampleTranslation','note','category','senseId'].map(k => [k, typeof item[k] === 'string' ? item[k].slice(0, 3000) : ''])), text: item.text, meaningZh: item.meaningZh, id: crypto.randomUUID() };
      const shortText = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 3000;
      const hasChinese = (value: unknown) => typeof value === 'string' && /[\u3400-\u9fff]/.test(value);
      if (requireStructured && (prefix === 'phrases' || prefix === 'usage') && !hasChinese(item.meaningZh)) throw new VocabularyDetailsError('请提供简体中文解释，已有资料已保留。');
      if (prefix === 'derivatives' && (item.family !== undefined || requireStructured)) {
        if (!shortText(item.family?.base) || !shortText(item.family?.relation) || !shortText(item.partOfSpeech) || (requireStructured && !hasChinese(item.family.relation))) throw new VocabularyDetailsError('派生词构词关系不完整，请重试。');
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
        if (!m || !['root','meaningZh','explanation'].every(key => shortText(m[key])) || (requireStructured && (!hasChinese(m.explanation) || !hasChinese(m.meaningZh))) || typeof m.mnemonic !== 'string' || m.mnemonic.length > 3000 || (requireStructured && m.mnemonic.trim() && !hasChinese(m.mnemonic)) || !Array.isArray(m.parts) || !m.parts.length || m.parts.length > 8
          || m.parts.some((part: any) => !['prefix','root','suffix'].includes(part?.kind) || !shortText(part.text) || !shortText(part.meaningZh))
          || !m.parts.some((part: any) => part.kind === 'root') || m.parts.map((part: any) => part.text).join('').toLowerCase() !== term.toLowerCase()
          || !Array.isArray(m.related) || m.related.length > 4 || m.related.some((word: any) => !['word','partOfSpeech','meaningZh'].every(key => shortText(word?.[key])))) throw new VocabularyDetailsError('构词拆解不完整或与原词不符，请重试。');
        entry.morphology = { root: m.root, meaningZh: m.meaningZh, parts: m.parts.map(({kind,text,meaningZh}: any) => ({kind,text,meaningZh})), explanation: m.explanation, mnemonic: m.mnemonic,
          related: [...new Map(m.related.filter((word: any) => word.word.trim().toLowerCase() !== term.toLowerCase()).map(({word,partOfSpeech,meaningZh}: any) => [word.trim().toLowerCase(), {word,partOfSpeech,meaningZh}])).values()] as NonNullable<LearningEntry['morphology']>['related'] };
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
  const excluded = new Set([term, ...data.inflections.map((form: any) => form.value), ...retainedInflections.map(form => form.value)].map(value => value.toLowerCase().trim()));
  const seen = new Set<string>();
  sections.derivatives = sections.derivatives.filter(entry => {
    const key = entry.text.toLowerCase().trim();
    if (excluded.has(key) || seen.has(key)) return false;
    seen.add(key); return true;
  });
  const phraseKeys = new Set<string>();
  sections.phrases = sections.phrases.filter(entry => { const key = entry.text.trim().replace(/\s+/g, ' '); if (phraseKeys.has(key)) return false; phraseKeys.add(key); return true; });
  // A model may incorrectly label a pronunciation note as grammar. Do not present it as usage.
  sections.usage = sections.usage.filter(entry => !isPronunciationOnlyUsage(entry));
  const category = VOCABULARY_CATEGORIES.includes(data.category) ? data.category : data.type === 'idiom' ? 'idiom' : type;
  const resolvedType = type === 'word' ? 'word' : category === 'idiom' ? 'idiom' : 'phrase';
  return { key: vocabularyKey(term, type), term, type: resolvedType, category, phoneticUK: data.phoneticUK, phoneticUS: data.phoneticUS, senses, inflections: category === 'word' ? data.inflections.map((form: any) => ({ label: inflectionLabel(form.label), value: form.value })) : [], sections, generated: true, generatedSections: [...DETAIL_SECTIONS], provenance: {}, updatedAt: Date.now() };
}
