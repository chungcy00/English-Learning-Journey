import { useEffect, useState } from 'react';
import type { ReadingExpression, ReadingRecord } from '../types';

const cache = new Map<string, Promise<ReadingExpression[]>>();

export function useReadingExpressions(reading: ReadingRecord | null) {
  const [expressions, setExpressions] = useState<ReadingExpression[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestedKey, setRequestedKey] = useState('');
  const [attempt, setAttempt] = useState(0);
  const key = reading ? `${reading.id}:${reading.content}` : '';
  useEffect(() => { setExpressions([]); setError(''); setLoading(false); }, [key]);
  useEffect(() => {
    if (requestedKey !== key || !key || !reading) return;
    let active = true;
    setLoading(true);
    setError('');
    let pending = cache.get(key);
    if (!pending) {
      pending = fetch('/api/vocabulary/candidates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextReading: reading.content }),
      }).then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '短文词条暂时无法加载，请重试。');
        if (!Array.isArray(body.expressions)) throw new Error('词条数据不完整，请重试。');
        return body.expressions as ReadingExpression[];
      }).catch(error => { cache.delete(key); throw error; });
      // Bound memory; cached requests are shared across the two search surfaces.
      if (cache.size >= 10) cache.delete(cache.keys().next().value!);
      cache.set(key, pending);
    }
    pending.then(items => { if (active) setExpressions(items); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : '加载失败，请重试。'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key, requestedKey, attempt]);
  return { expressions, loading, error, load: () => setRequestedKey(key), retry: () => { setRequestedKey(key); setAttempt(value => value + 1); } };
}
