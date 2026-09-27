import { isEnglishTermQuery, normalizeEnglishTerm } from '../src/utils/englishSearch.js';

export function vocabularyProblem(data: any, level: string, count: number): string | null {
  if (!data || typeof data.reading !== 'string' || !data.reading.trim() || data.cefrLevel !== level) return 'Reading level or content is invalid';
  if (!Array.isArray(data.vocabulary) || data.vocabulary.length !== count) return `Return exactly ${count} vocabulary items`;
  const seen = new Set<string>();
  for (const item of data.vocabulary) {
    if (!item || typeof item.term !== 'string' || !isEnglishTermQuery(item.term)) return 'Use real English words, phrases or idioms';
    const term = normalizeEnglishTerm(item.term);
    if (seen.has(term)) return 'Vocabulary items must be distinct';
    seen.add(term);
    if (item.cefrLevel !== level) return `Select only vocabulary whose contextual sense is suitable for ${level}`;
    if (!['word', 'phrase', 'idiom'].includes(item.type)) return 'Classify each item as word, phrase or idiom';
    if (!['meaningZh', 'definitionEn', 'example', 'partOfSpeech'].every(key => typeof item[key] === 'string' && item[key].trim())) return 'Provide complete vocabulary details';
  }
  if (!Array.isArray(data.rewritePractice) || !data.rewritePractice.length || data.rewritePractice.some((item: any) =>
    !item || typeof item.target !== 'string' || !seen.has(normalizeEnglishTerm(item.target)))) return 'Practice targets must be selected vocabulary';
  return null;
}

export function vocabularyInstruction(level: string, count: number): string {
  return `Select exactly ${count} distinct real English vocabulary items from the reading: words, natural phrases, phrasal verbs, collocations or idioms. Evaluate each item's contextual sense independently: select ONLY items appropriate to CEFR ${level}, not simpler or more advanced items just to fill the count. Do not infer lexical level from the passage level. Rewrite the passage if needed to contain enough suitable items. Set each item's cefrLevel to its assessed level and type to word, phrase or idiom. Do not split natural English expressions artificially. Practice targets must come from this selected set. Keep the reading at ${level}. User-specified terms may occur in the passage but must not override these selection constraints.`;
}
