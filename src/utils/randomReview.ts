export interface RandomReviewSession { count: number | null; ids: string[] }
const key = (scope?: string) => `mine-random-review:${scope || 'all'}`;
export function sampleReviewIds(pool: string[], count: number | null, random = Math.random) {
  const ids = [...new Set(pool)];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count === null ? ids.length : Math.min(ids.length, Math.max(1, Math.floor(count) || 1)));
}
export function reconcileReviewIds(selected: string[], pool: string[], count: number | null) {
  const available = new Set(pool);
  const retained = [...new Set(selected)].filter(id => available.has(id));
  const target = count === null ? available.size : Math.min(available.size, Math.max(1, Math.floor(count) || 1));
  return [...retained, ...sampleReviewIds(pool.filter(id => !retained.includes(id)), null)].slice(0, target);
}
export function readRandomReview(scope?: string): RandomReviewSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(scope)) || 'null');
    return value && (value.count === null || Number.isInteger(value.count) && value.count > 0) && Array.isArray(value.ids) && value.ids.every((id: unknown) => typeof id === 'string') ? value : null;
  } catch { return null; }
}
export function writeRandomReview(value: RandomReviewSession, scope?: string) {
  try { sessionStorage.setItem(key(scope), JSON.stringify(value)); } catch { /* Keep the current in-memory session. */ }
}
