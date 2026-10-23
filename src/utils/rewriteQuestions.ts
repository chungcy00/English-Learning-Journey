import type { RewritePracticeItem } from '../types';
import { rewriteProgressKey } from './rewriteProgress';

/** Identical duplicates represent one exercise; reused IDs with different content remain distinct. */
export function uniqueRewriteQuestions(readingId: string, items: RewritePracticeItem[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = rewriteProgressKey(readingId, item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rewriteNextAction(index: number, evaluated: boolean[]) {
  if (index < evaluated.length - 1) return { label: '下一题', index: index + 1 };
  const unfinished = evaluated.findIndex(done => !done);
  return unfinished < 0 ? { label: '完成练习', index: null } : { label: '继续未完成题目', index: unfinished };
}

const selections = new Map<string, string>();
export function readRewriteSelection(readingId: string) {
  if (selections.has(readingId)) return selections.get(readingId);
  try { return typeof window !== 'undefined' ? window.localStorage.getItem(`mine_english_rewrite_selection_v1:${readingId}`) ?? undefined : undefined; } catch { return undefined; }
}
export function writeRewriteSelection(readingId: string, key: string) {
  selections.set(readingId, key);
  try { window.localStorage.setItem(`mine_english_rewrite_selection_v1:${readingId}`, key); } catch { /* Position is retained for this session; draft save failures use the existing protection. */ }
}
