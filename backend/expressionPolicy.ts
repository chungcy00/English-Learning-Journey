import { isEnglishTermQuery, normalizeEnglishTerm } from '../src/utils/englishSearch.js';

const basicPronouns = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their']);

// Never infer lexical CEFR from the passage, or manufacture arbitrary n-grams.
export function validateExpressions(result: any, reading: string) {
  if (!Array.isArray(result?.expressions) || result.expressions.length > 100) throw new Error('Invalid expression catalogue');
  const seen = new Set<string>();
  return result.expressions.filter((item: any) => {
    if (!item || typeof item.term !== 'string' || item.term.length > 160 || !isEnglishTermQuery(item.term) ||
      !['word', 'phrase', 'idiom'].includes(item.type) || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(item.cefrLevel) ||
      item.isValidTerm === false || typeof item.contextQuote !== 'string' || !item.contextQuote.trim() ||
      !normalizeEnglishTerm(reading).includes(normalizeEnglishTerm(item.contextQuote))) return false;
    const term = normalizeEnglishTerm(item.term);
    if (seen.has(term)) return false;
    seen.add(term);
    return true;
  }).map(({ term, type, cefrLevel, contextQuote }: any) => ({ term, type,
    cefrLevel: basicPronouns.has(normalizeEnglishTerm(term)) ? 'A1' : cefrLevel, contextQuote }));
}
