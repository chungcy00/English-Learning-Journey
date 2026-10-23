const KEY = 'mine_english_review_progress';
export interface ReviewProgress { currentId: string; revealed: boolean; completed: boolean; ids: string[] }
export function readReviewProgress(scope?: string): ReviewProgress | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(scope ? `${KEY}:${scope}` : KEY) || 'null');
    return value && typeof value.currentId === 'string' && typeof value.revealed === 'boolean' &&
      typeof value.completed === 'boolean' && Array.isArray(value.ids) && value.ids.every((id: unknown) => typeof id === 'string') ? value : null;
  } catch { return null; }
}
export function writeReviewProgress(value: ReviewProgress, scope?: string) {
  try { sessionStorage.setItem(scope ? `${KEY}:${scope}` : KEY, JSON.stringify(value)); } catch { /* Storage may be unavailable. */ }
}
export function restoreReviewProgress(ids: string[], value: ReviewProgress | null) {
  const index = value ? ids.indexOf(value.currentId) : -1;
  return { index: Math.max(0, index), revealed: index >= 0 && !!value?.revealed,
    completed: index >= 0 && !!value?.completed && ids.length === value.ids.length && ids.every(id => value.ids.includes(id)) };
}
