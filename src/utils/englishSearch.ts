// Keep whole expressions intact, including idioms such as "so far, so good".
const ENGLISH_TERM_PATTERN = /^[a-z]+(?:['’-][a-z]+)*(?:(?:\s+|,\s*)[a-z]+(?:['’-][a-z]+)*)*[.!?]?$/i;

export interface VocabularySearchFields {
  term: string;
  definitionEn?: string;
  meanings?: Array<string | undefined>;
  sourceText?: string;
}

export function normalizeEnglishTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function isEnglishTermQuery(value: string): boolean {
  const normalized = normalizeEnglishTerm(value);
  return normalized.length > 0 && ENGLISH_TERM_PATTERN.test(normalized);
}

export function getEnglishTermMatchRank(term: string, query: string): number | null {
  const normalizedTerm = normalizeEnglishTerm(term);
  const normalizedQuery = normalizeEnglishTerm(query);
  if (!normalizedQuery || !isEnglishTermQuery(normalizedQuery)) return null;

  if (normalizedTerm === normalizedQuery) return 0;
  if (normalizedTerm.startsWith(normalizedQuery)) return 1;

  const termWords = normalizedTerm.split(' ');
  const queryWords = normalizedQuery.split(' ');
  const matchesInsidePhrase = termWords.length > 1 && termWords.slice(1).some((_, startIndex) =>
    queryWords.every((queryWord, queryIndex) => {
      const termWord = termWords[startIndex + queryIndex + 1];
      return !!termWord && termWord.startsWith(queryWord);
    })
  );
  if (matchesInsidePhrase) {
    return 2;
  }

  if (normalizedTerm.includes(normalizedQuery)) return 3;

  return null;
}

export function getVocabularySearchRank(
  fields: VocabularySearchFields,
  query: string
): number | null {
  const normalizedQuery = normalizeEnglishTerm(query);
  if (!normalizedQuery) return null;

  if (isEnglishTermQuery(normalizedQuery)) {
    const termRank = getEnglishTermMatchRank(fields.term, normalizedQuery);
    if (termRank !== null) return termRank;
  }

  if (normalizeEnglishTerm(fields.definitionEn || '').includes(normalizedQuery)) return 4;

  if ((fields.meanings || []).some(meaning =>
    normalizeEnglishTerm(meaning || '').includes(normalizedQuery)
  )) return 5;

  if (normalizeEnglishTerm(fields.sourceText || '').includes(normalizedQuery)) return 6;

  return null;
}

export function extractEnglishWords(text: string): string[] {
  return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || [];
}

// Exact boundaries for local suggestions; inflections are assessed by the server
// with an excerpt, never inferred by substring matching (e.g. he/the).
export function containsEnglishExpression(text: string, term: string): boolean {
  if (!isEnglishTermQuery(term)) return false;
  const escaped = normalizeEnglishTerm(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z'\\-])${escaped}(?=$|[^a-z'\\-])`, 'i').test(normalizeEnglishTerm(text));
}

export function readingTermSuggestions(content: string, confirmedTerms: string[], query: string): string[] {
  if (!isEnglishTermQuery(query)) return [];
  // Suggestions are labels, so showing an unverified token beside the selected
  // CEFR level would falsely imply that it already passed level validation.
  // Unknown expressions can still be entered manually and are verified by the
  // server before saving, but they must not appear in this confirmed list.
  return [...new Set(confirmedTerms
    .filter(term => containsEnglishExpression(content, term))
    .map(normalizeEnglishTerm))]
    .filter(term => getEnglishTermMatchRank(term, query) !== null)
    .sort((a, b) => (getEnglishTermMatchRank(a, query)! - getEnglishTermMatchRank(b, query)!) || a.localeCompare(b, 'en'))
    .slice(0, 8);
}

export function hasEnglishWordSequence(text: string, query: string): boolean {
  const queryWords = extractEnglishWords(normalizeEnglishTerm(query)).map(normalizeEnglishTerm);
  if (queryWords.length === 0 || !isEnglishTermQuery(query)) return false;

  const textWords = extractEnglishWords(text).map(normalizeEnglishTerm);
  for (let start = 0; start <= textWords.length - queryWords.length; start++) {
    const matches = queryWords.every((queryWord, index) => {
      const textWord = textWords[start + index];
      return index === queryWords.length - 1
        ? textWord.startsWith(queryWord)
        : textWord === queryWord;
    });
    if (matches) return true;
  }

  return false;
}
