import type { ReadingExpression, ReadingRecord, VocabularyItem, VocabStatus } from '../types';
import { extractEnglishWords, containsEnglishExpression, getEnglishTermMatchRank, normalizeEnglishTerm } from './englishSearch';
import { filterSavedVocabulary } from './savedVocabulary';
export const wordbookStatuses: Record<VocabStatus, string> = { New: '新词', Learning: '学习中', Difficult: '困难', Mastered: '已掌握' };
export function wordbookMeta(item: Pick<VocabularyItem, 'partOfSpeech' | 'type'>) {
  const positions: Record<string,string> = {
    noun:'名词', n:'名词', 'n.':'名词', verb:'动词', v:'动词', 'v.':'动词',
    adjective:'形容词', adj:'形容词', 'adj.':'形容词', adverb:'副词', adv:'副词', 'adv.':'副词',
    'noun phrase':'名词短语', 'verb phrase':'动词短语', 'phrasal verb':'短语动词',
    'adjective phrase':'形容词短语', 'adverb phrase':'副词短语', 'prepositional phrase':'介词短语',
    phrase:'短语', word:'单词', idiom:'习语', expression:'表达',
    preposition:'介词', prep:'介词', 'prep.':'介词', pronoun:'代词', pron:'代词', 'pron.':'代词',
    conjunction:'连词', conj:'连词', 'conj.':'连词', interjection:'感叹词', interj:'感叹词', 'interj.':'感叹词',
    determiner:'限定词', det:'限定词', 'det.':'限定词', article:'冠词', numeral:'数词',
    'auxiliary verb':'助动词', 'modal verb':'情态动词', 'transitive verb':'及物动词', 'vt.':'及物动词',
    'intransitive verb':'不及物动词', 'vi.':'不及物动词',
  };
  const pos = item.partOfSpeech?.trim();
  const type = ({word:'单词',phrase:'短语',idiom:'习语'})[item.type];
  return [...new Set([pos ? positions[pos.toLowerCase()] || pos : '',type].filter(Boolean))].join(' · ');
}
export function wordbookResults(items: VocabularyItem[], query: string, status: string, descending: boolean) {
  const matching = filterSavedVocabulary(items,query,'All');
  const filtered = filterSavedVocabulary(items,query,status);
  // A saved expression must stay discoverable even under a mismatching status filter.
  const fallback = !!query.trim() && matching.length > filtered.length;
  const visible = fallback ? matching : filtered;
  return { visible: descending ? [...visible].reverse() : visible, fallback };
}
export function wordbookSuggestions(reading: ReadingRecord | null, expressions: ReadingExpression[], saved: VocabularyItem[], query: string) {
  if (!reading || !query.trim()) return [];
  const savedTerms = new Set(saved.map(v=>normalizeEnglishTerm(v.term)));
  const known = new Map((reading.selectedVocabulary || []).filter(v=>containsEnglishExpression(reading.content,v.term)).map(v=>[normalizeEnglishTerm(v.term),v]));
  const words = extractEnglishWords(reading.content);
  const terms = [...expressions.filter(v=>containsEnglishExpression(reading.content,v.term)).map(v=>v.term),...known.keys(),...words];
  if (containsEnglishExpression(reading.content,query)) terms.push(query);
  return [...new Set(terms.map(normalizeEnglishTerm))].filter(term=>!savedTerms.has(term) && getEnglishTermMatchRank(term,query)!==null)
    .sort((a,b)=>getEnglishTermMatchRank(a,query)!-getEnglishTermMatchRank(b,query)!||a.localeCompare(b,'en')).slice(0,12)
    .map(term=>({term,item:known.get(term),type: known.get(term)?.type || expressions.find(v=>normalizeEnglishTerm(v.term)===term)?.type || (term.includes(' ')?'phrase':'word') as VocabularyItem['type']}));
}
export function toggleVisibleSelection(selected: string[], visible: string[]) {
  const all = visible.length > 0 && visible.every(id=>selected.includes(id));
  return all ? selected.filter(id=>!visible.includes(id)) : [...new Set([...selected,...visible])];
}
