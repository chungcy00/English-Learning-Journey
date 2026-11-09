import type { ReadingRecord } from '../types';
// Local catalogue only. Opening a passage or a menu never invokes AI.
export function useReadingExpressions(reading: ReadingRecord | null) {
  const expressions = reading?.expressionCatalogue?.content === reading?.content
    ? reading?.expressionCatalogue?.expressions || []
    : (reading?.selectedVocabulary || []).map(item => ({ term: item.term, type: item.type, cefrLevel: item.cefrLevel || reading!.cefrLevel, contextQuote: '' }));
  return { expressions, loading: false, error: '', load: () => {}, retry: () => {} };
}
