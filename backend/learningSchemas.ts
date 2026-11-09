import { Type } from '@google/genai';
import { DETAIL_SECTIONS, VOCABULARY_CATEGORIES, type VocabularyDetails, type LearningEntry, type DetailSection } from '../src/types.js';
import { isChineseUsageExplanation } from '../src/utils/usageLanguage.js';
import { hasExactParts } from '../src/utils/wordFormation.js';
import { inflectionLabel, vocabularyKey } from '../src/utils/vocabularyDetails.js';
export class VocabularyDetailsError extends Error { name = 'VocabularyDetailsError'; }
const string = { type: Type.STRING };
const chinese = { ...string, description: '用简体中文解释，可保留英文单词和构词符号。', pattern: '[㐀-鿿]' };
const optionalChinese = { ...chinese, pattern: '^$|[㐀-鿿]' };
const entries = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
  text: string, meaningZh: string, partOfSpeech: string, example: string, exampleTranslation: string, note: string, category: string, senseId: string,
}, required: ['text', 'meaningZh'] } };
const wordParts = { type: Type.ARRAY, description: '可选的真实构词分段；按原词表面拼写排列，可留空，不得根据相似字母编造。', items: { type: Type.OBJECT, properties: { kind: { type: Type.STRING, enum: ['prefix','root','suffix'] }, text: string, meaningZh: chinese }, required: ['kind','text','meaningZh'] } };
const family = { type: Type.OBJECT, properties: { base: string, parent: { ...string, description: '有把握时给出直接派生自的英文词，可为原词或本词族其他词，不得填自身；不确定则省略。' }, parts: wordParts, relation: { ...chinese, description: '用简体中文解释真实派生步骤。例：helpful + -ly → helpfully，形容词加 -ly 变为副词；不能把 -fully 虚写成这里的单一后缀。' } }, required: ['base', 'relation'] };
const morphology = { type: Type.OBJECT, properties: {
  root: string, meaningZh: chinese,
  parts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { kind: { type: Type.STRING, enum: ['prefix', 'root', 'suffix'] }, text: string, meaningZh: chinese }, required: ['kind', 'text', 'meaningZh'] } },
  explanation: { ...chinese, description: '用简体中文说明各部分如何组合成原词含义，拼写变化也需解释。不能只介绍词源或整段使用英文。' }, mnemonic: { ...optionalChinese, description: '简短自然的中文辅助记忆联想，不冒充真实词源；无合适联想可留空。' },
  related: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { word: string, partOfSpeech: string, meaningZh: chinese, relation: optionalChinese, parts: wordParts }, required: ['word', 'partOfSpeech', 'meaningZh'] } },
}, required: ['root', 'meaningZh', 'parts', 'explanation', 'mnemonic', 'related'] };
const derivativeEntries = { ...entries, description: '只提供通用学习场景下常见、真实的派生词，不以偶见的否定分词或专门术语凑数。若只能想到罕见构词形式，返回空数组。', items: { ...entries.items, properties: { ...entries.items.properties, family }, required: ['text', 'meaningZh', 'partOfSpeech', 'family'] } };
const rootEntries = { ...entries, items: { ...entries.items, properties: { ...entries.items.properties, morphology }, required: ['text', 'meaningZh', 'morphology'] } };
const exampleEntries = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { ...string, description: 'A complete natural English example sentence, never a headword or collocation label.' }, meaningZh: { ...chinese, description: '这句例句的完整中文译文，不是单词词义。单词词义通过 senseId 关联 senses。' }, senseId: string, senseMeaningZh: { ...optionalChinese, description: '本例句对应的简体中文单词词义，不是句子译文。可细分已合并的多义释义，如扎根的与根深蒂固的；仍沿用同一原义项 senseId，不得添加无关新义。' }, note: string }, required: ['text','meaningZh','senseId'] } };
const definitionEntries = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { ...string, description: 'A short, clear English-only learner definition of one main sense. No Chinese, translation, IPA, POS labels or heading.' }, meaningZh: { ...string, enum: [''] }, senseId: string }, required: ['text','meaningZh'] } };
const phraseEntries = { type: Type.ARRAY, description: 'Practical learner-dictionary expressions. Usually 4–8 distinct common expressions if available, at most 10; preserve articles and prepositions. Never pad obscure combinations.', items: { type: Type.OBJECT, properties: { text: { ...string, description: '完整自然的常见英文表达，保留必要冠词、介词和句型结构。' }, meaningZh: chinese, category: string, example: string, exampleTranslation: string, note: string }, required: ['text', 'meaningZh'] } };
const usageEntries = { type: Type.ARRAY, description: '面向英语非母语学习者的实用中文说明。每点解释怎么用、何时用或与哪个词易混，用日常词语写一至三句；不讲词源、历史来源、抽象理论或无关学术知识。', items: { type: Type.OBJECT, properties: {
  text: { ...chinese, description: '简短中文标题，可包含所讨论的英文单词或搭配；不写英文解释句。' },
  meaningZh: { ...chinese, description: '用简明简体中文讲清怎么用、何时用、和哪个词有何区别，一至三句；英文只用于单词、搭配或句型，完整英文例句放 example。不要讲历史、词源、抽象理论或用术语堆砌。讲介词时不臆造抽象/具体选择规则。' },
  example: { ...string, description: 'A short natural English sentence illustrating the explanation, if useful.' }, exampleTranslation: optionalChinese, note: { ...optionalChinese, description: '可选简短中文补充，最多一两句，不重复正文。不写英文长解释、词源、历史背景或学术性分析；没有必要则留空。英文术语嵌入中文句子即可。' },
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
  sections: { type: Type.OBJECT, properties: Object.fromEntries(DETAIL_SECTIONS.map(key => [key, key === 'derivatives' ? derivativeEntries : key === 'roots' ? rootEntries : key === 'phrases' ? phraseEntries : key === 'usage' ? usageEntries : key === 'definitions' ? definitionEntries : key === 'examples' ? exampleEntries : entries])), required: [...DETAIL_SECTIONS] },
}, required: ['isValidTerm', 'term', 'type', 'category', 'phoneticUK', 'phoneticUS', 'senses', 'inflections', 'sections'] };
// Refreshes request only the selected column. Unexpected columns are discarded
// before validation so they cannot fail a refresh or replace unrelated cache.
export function detailsSchemaForSection(section?: DetailSection) {
  if (!section) return detailsSchema;
  return { ...detailsSchema, properties: { ...detailsSchema.properties, sections: {
    type: Type.OBJECT, properties: { [section]: detailsSchema.properties.sections.properties[section] }, required: [section],
  } } };
}
export function isolateRequestedSection(data: any, section?: DetailSection) {
  if (!section) return data;
  return { ...data, sections: Object.fromEntries(DETAIL_SECTIONS.map(key => [key, key === section ? data?.sections?.[key] : []])) };
}
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
      if (prefix === 'usage' && requireStructured) {
        for (const field of ['meaningZh','note','exampleTranslation']) {
          if ((field === 'meaningZh' || item[field]) && !isChineseUsageExplanation(item[field] || '')) throw new VocabularyDetailsError('用法辨析正文和补充说明需要简明中文，英文例句请单独填写。');
        }
      }
      if (prefix === 'examples' && item.senseMeaningZh) {
        if (!shortText(item.senseMeaningZh) || (requireStructured && !hasChinese(item.senseMeaningZh))) throw new VocabularyDetailsError('例句对应词义需要简体中文，请重试。');
        entry.senseMeaningZh = item.senseMeaningZh.trim();
      }
      if (prefix === 'definitions' && requireStructured && (!/[a-z]/i.test(item.text) || hasChinese(item.text) || item.meaningZh.trim())) throw new VocabularyDetailsError('英释需要简明纯英文定义，请重试。');
      if (prefix === 'derivatives' && (item.family !== undefined || requireStructured)) {
        if (!shortText(item.family?.base) || !shortText(item.family?.relation) || !shortText(item.partOfSpeech) || (requireStructured && !hasChinese(item.family.relation))) throw new VocabularyDetailsError('派生词构词关系不完整，请重试。');
        entry.family = { base: item.family.base.trim(), relation: item.family.relation.trim() };
        if (item.family.parent) {
          if (!shortText(item.family.parent) || item.family.parent.trim().toLowerCase() === item.text.trim().toLowerCase()) throw new VocabularyDetailsError('派生父词关系无效，请重试。');
          entry.family.parent = item.family.parent.trim();
        }
        if (item.family.parts?.length) {
          if (!hasExactParts(item.family.parts,item.text)) throw new VocabularyDetailsError('派生词分段与单词不符，请重试。');
          entry.family.parts = item.family.parts.map(({kind,text,meaningZh}: any)=>({kind,text,meaningZh}));
        }
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
          related: [...new Map(m.related.filter((word: any) => word.word.trim().toLowerCase() !== term.toLowerCase()).map((related: any) => {
            const {word,partOfSpeech,meaningZh,relation,parts}=related;
            if (relation && (!shortText(relation) || (requireStructured && !hasChinese(relation)))) throw new VocabularyDetailsError('同根词构词说明需要中文，请重试。');
            if (parts?.length && !hasExactParts(parts,word)) throw new VocabularyDetailsError('同根词分段与单词不符，请重试。');
            return [word.trim().toLowerCase(), {word,partOfSpeech,meaningZh,...(relation?{relation}:{}),...(parts?.length?{parts:parts.map(({kind,text,meaningZh}:any)=>({kind,text,meaningZh}))}:{})}];
          })).values()] as NonNullable<LearningEntry['morphology']>['related'] };
      }
      if (prefix === 'usage' && (item.usageKind !== undefined || requireStructured)) {
        if (!['scenario','grammar','comparison','error','register','natural'].includes(item.usageKind)) throw new VocabularyDetailsError('用法辨析类型不受支持，请重试。');
        entry.usageKind = item.usageKind;
      }
      if (prefix === 'usage' && item.contrast != null && !(item.contrast.incorrect === '' && item.contrast.correct === '')) {
        // The pair is optional enrichment. Never show partial placeholders or
        // present style alternatives as errors, and keep the valid explanation.
        if (item.usageKind === 'error' && shortText(item.contrast?.incorrect) && shortText(item.contrast?.correct) && item.contrast.incorrect.trim() !== item.contrast.correct.trim()) {
          entry.contrast = { incorrect: item.contrast.incorrect, correct: item.contrast.correct };
        }
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
  const familyByWord = new Map(sections.derivatives.map(entry=>[entry.text.trim().toLowerCase(),entry]));
  for (const entry of sections.derivatives) {
    const seen = new Set<string>([entry.text.trim().toLowerCase()]);
    let parent = entry.family?.parent?.trim().toLowerCase();
    while (parent && familyByWord.has(parent)) {
      if (seen.has(parent)) throw new VocabularyDetailsError('派生词关系形成循环，请重试。');
      seen.add(parent); parent = familyByWord.get(parent)?.family?.parent?.trim().toLowerCase();
    }
  }
  const phraseKeys = new Set<string>();
  sections.phrases = sections.phrases.filter(entry => { const key = entry.text.trim().replace(/\s+/g, ' '); if (phraseKeys.has(key)) return false; phraseKeys.add(key); return true; });
  // A model may incorrectly label a pronunciation note as grammar. Do not present it as usage.
  sections.usage = sections.usage.filter(entry => !isPronunciationOnlyUsage(entry));
  const category = VOCABULARY_CATEGORIES.includes(data.category) ? data.category : data.type === 'idiom' ? 'idiom' : type;
  const resolvedType = type === 'word' ? 'word' : category === 'idiom' ? 'idiom' : 'phrase';
  return { key: vocabularyKey(term, type), term, type: resolvedType, category, phoneticUK: data.phoneticUK, phoneticUS: data.phoneticUS, senses, inflections: category === 'word' ? data.inflections.map((form: any) => ({ label: inflectionLabel(form.label), value: form.value })) : [], sections, generated: true, generatedSections: [...DETAIL_SECTIONS], provenance: {}, updatedAt: Date.now() };
}
