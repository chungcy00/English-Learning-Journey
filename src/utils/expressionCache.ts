import type { ReadingExpression, ReadingRecord } from '../types';

export const EXPRESSION_CACHE_VERSION = 1;
type Catalogue = NonNullable<ReadingRecord['expressionCatalogue']>;

export function validCatalogue(catalogue: Catalogue | undefined, content: string): catalogue is Catalogue {
  return !!catalogue && catalogue.version === EXPRESSION_CACHE_VERSION && catalogue.content === content &&
    Array.isArray(catalogue.expressions) && catalogue.expressions.length <= 100 && catalogue.expressions.every(item =>
      !!item && typeof item.term === 'string' && ['word', 'phrase', 'idiom'].includes(item.type) &&
      ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(item.cefrLevel) && typeof item.contextQuote === 'string');
}

// Stale translation/vocabulary saves must not erase a freshly prepared catalogue.
export function preserveCatalogue(reading: ReadingRecord, previous?: ReadingRecord): ReadingRecord {
  const catalogue = validCatalogue(previous?.expressionCatalogue, reading.content) ? previous!.expressionCatalogue : reading.expressionCatalogue;
  return { ...reading, expressionCatalogue: validCatalogue(catalogue, reading.content) ? catalogue : undefined };
}

export function createExpressionLoader(store: {
  read: (id: string) => Promise<ReadingRecord | undefined>;
  save: (id: string, catalogue: Catalogue) => Promise<void>;
  fetch: (content: string) => Promise<ReadingExpression[]>;
}) {
  const cache = new Map<string, Promise<ReadingExpression[]>>();
  return (reading: ReadingRecord, retry = false): Promise<ReadingExpression[]> => {
    const key = `${reading.id}:${reading.content}`;
    if (retry) cache.delete(key);
    const existing = cache.get(key);
    if (existing) return existing;
    const pending = (async () => {
      const saved = await store.read(reading.id).catch(() => undefined);
      const catalogue = saved?.expressionCatalogue ?? reading.expressionCatalogue;
      if (validCatalogue(catalogue, reading.content)) return catalogue.expressions;
      const expressions = await store.fetch(reading.content);
      const prepared = { version: EXPRESSION_CACHE_VERSION, content: reading.content, expressions };
      if (!validCatalogue(prepared, reading.content)) throw new Error('词条数据不完整，请重试。');
      await store.save(reading.id, prepared).catch(() => undefined);
      return expressions;
    })();
    if (cache.size >= 10) cache.delete(cache.keys().next().value!);
    cache.set(key, pending);
    // Keep failures until explicit retry, avoiding quota consumption on tab switches.
    return pending;
  };
}
