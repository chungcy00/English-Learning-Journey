import { useEffect, useState } from 'react';
import type { ReadingExpression, ReadingRecord } from '../types';
import { loadReadingExpressions } from '../services/readingExpressions';

export function useReadingExpressions(reading: ReadingRecord | null) {
  const [expressions, setExpressions] = useState<ReadingExpression[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const key = reading ? `${reading.id}:${reading.content}` : '';
  useEffect(() => {
    setExpressions([]); setError(''); setLoading(false);
    if (!reading) return;
    let active = true;
    setLoading(true);
    loadReadingExpressions(reading).then(items => { if (active) setExpressions(items); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : '加载失败，请重试。'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key, attempt]);
  return { expressions, loading, error, load: () => {}, retry: () => {
    if (!reading || loading) return;
    void loadReadingExpressions(reading, true).catch(() => {});
    setAttempt(value => value + 1);
  } };
}
