import { db } from '../db/dexie';
import { createExpressionLoader } from '../utils/expressionCache';

export const loadReadingExpressions = createExpressionLoader({
  read: id => db.readings.get(id),
  save: async (id, expressionCatalogue) => {
    await db.transaction('rw', db.readings, async () => {
      const latest = await db.readings.get(id);
      // Never resurrect deleted passages or attach old results to a rewritten passage.
      if (latest?.content === expressionCatalogue.content) await db.readings.update(id, { expressionCatalogue });
    });
  },
  fetch: async contextReading => {
    const response = await fetch('/api/vocabulary/candidates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextReading }), signal: AbortSignal.timeout(60_000),
    });
    const body = await response.json().catch(() => { throw new Error('短文词条服务暂不可用，请稍后重试。'); });
    if (!response.ok) throw new Error(body.error || '短文词条暂时无法加载，请重试。');
    return body.expressions;
  },
});
