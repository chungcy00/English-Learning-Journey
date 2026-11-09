import { DETAIL_SECTIONS, type DetailSection, type LearningEntry, type VocabularyDetails, type VocabularyItem, type VocabularyCategory } from '../types';

export const sectionLabels: Record<DetailSection, string> = { examples: '例句', derivatives: '派生', roots: '词根', phrases: '词组', definitions: '英释', usage: '用法辨析' };
export const categoryLabels: Record<VocabularyCategory, string> = { word: '单词', phrase: '短语', idiom: '习语', collocation: '搭配', 'phrasal-verb': '短语动词' };
export const cleanTerm = (term: string) => term.replace(/’/g, "'").replace(/\s+/g, ' ').trim();
// Preserve case-sensitive names and abbreviations rather than merging US/us or Polish/polish.
export const vocabularyKey = (term: string, type: VocabularyItem['type']) => `${type === 'word' ? 'word' : 'phrase'}:${cleanTerm(term)}`;
export const materialKey = (type: 'example' | 'phrase', text: string) => `${type}:${cleanTerm(text)}`;
export function basicVocabulary(term: string, type: VocabularyItem['type'] = term.includes(' ') ? 'phrase' : 'word'): VocabularyItem {
  const now = Date.now();
  return { id: `vocab_${crypto.randomUUID()}`, term: cleanTerm(term), type, phonetic: '', partOfSpeech: '', meaningZh: '', definitionEn: '', example: '', collocations: [], origin: 'manual', savedManually: true, status: 'New', createdAt: now, updatedAt: now, nextReviewDate: now, reviewCount: 0, currentInterval: 0 };
}
export function legacyDetails(vocab: VocabularyItem): VocabularyDetails {
  if (vocab.details) return vocab.details;
  const entry = (text: string, meaningZh = ''): LearningEntry => ({ id: crypto.randomUUID(), text, meaningZh });
  return { key: vocabularyKey(vocab.term, vocab.type), term: vocab.term, type: vocab.type, category: vocab.category || (vocab.type === 'word' || vocab.type === 'idiom' ? vocab.type : undefined), phoneticUK: vocab.phonetic || '', phoneticUS: '',
    senses: vocab.meaningZh ? [{ ...entry(vocab.meaningZh, vocab.meaningZh), partOfSpeech: vocab.partOfSpeech }] : [], inflections: [],
    sections: { examples: vocab.example ? [entry(vocab.example, vocab.translations?.['zh-CN']?.exampleTranslation || '')] : [], derivatives: [], roots: [], phrases: (vocab.collocations || []).map(text => entry(text)), definitions: vocab.definitionEn ? [entry(vocab.definitionEn)] : [], usage: [] }, generated: false, provenance: {}, updatedAt: vocab.updatedAt };
}
export function mergeGeneratedDetails(current: VocabularyDetails, incoming: VocabularyDetails, section?: DetailSection, replaceEdited = false): VocabularyDetails {
  const next = { ...current, type: incoming.type, category: incoming.category || incoming.type, sections: { ...current.sections }, provenance: { ...current.provenance }, generatedSections: [...(current.generatedSections || [])], updatedAt: Date.now() };
  for (const key of section ? [section] : DETAIL_SECTIONS) {
    if (current.provenance[key]?.source === 'user' && !replaceEdited) continue;
    const retainedBasic = !!section || (current.provenance.basic?.source === 'user' && !replaceEdited);
    next.sections[key] = incoming.sections[key].map(entry => {
      if (!retainedBasic || !entry.senseId) return entry;
      if (current.senses.some(sense => sense.id === entry.senseId)) return entry;
      const incomingSense = incoming.senses.find(sense => sense.id === entry.senseId);
      const match = incomingSense && current.senses.find(sense => sense.partOfSpeech === incomingSense.partOfSpeech && sense.text.trim() === incomingSense.text.trim() && sense.meaningZh.trim() === incomingSense.meaningZh.trim());
      return { ...entry, senseId: match?.id || '' };
    });
    next.provenance[key] = { source: 'ai', updatedAt: next.updatedAt };
    if (!next.generatedSections.includes(key)) next.generatedSections.push(key);
  }
  if (!section && (current.provenance.basic?.source !== 'user' || replaceEdited)) {
    next.phoneticUK = incoming.phoneticUK; next.phoneticUS = incoming.phoneticUS; next.senses = incoming.senses;
    next.inflections = current.type === 'word' ? incoming.inflections : [];
    next.provenance.basic = { source: 'ai', updatedAt: next.updatedAt };
  }
  next.generated = DETAIL_SECTIONS.every(key => next.generatedSections.includes(key) || next.provenance[key]?.source === 'user');
  return next;
}
