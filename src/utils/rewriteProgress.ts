import type { RewriteEvaluation, RewritePracticeItem } from '../types';

export interface RewriteProgress {
  answer: string;
  evaluation?: RewriteEvaluation;
  lastEvaluated?: { answer: string; evaluation: RewriteEvaluation };
  editing?: boolean;
  pending: boolean;
  saved: boolean;
  error?: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

// Include exercise content: regenerating an exercise with a reused ID must not
// restore an answer to a different question. No whole-reading writes or races.
export function rewriteProgressKey(readingId: string, item: RewritePracticeItem): string {
  return `mine_english_rewrite_v1:${JSON.stringify([readingId, item.id, item.originalSentence, item.target, item.referenceAnswer])}`;
}

export function createRewriteProgressStore(storage: () => StorageLike | undefined) {
  const entries = new Map<string, RewriteProgress>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  const persist = (key: string, progress: RewriteProgress): RewriteProgress => {
    try {
      const target = storage();
      if (!target) throw new Error('Storage unavailable');
      target.setItem(key, JSON.stringify({ answer: progress.answer, evaluation: progress.evaluation, lastEvaluated: progress.lastEvaluated, editing: progress.editing }));
      return { ...progress, saved: true };
    } catch {
      // Keep the in-memory copy across page navigation, but never claim durability.
      return { ...progress, saved: false };
    }
  };
  const get = (key: string, item: RewritePracticeItem): RewriteProgress => {
    const cached = entries.get(key);
    if (cached) return cached;
    const initialAnswer = item.userAnswer || '';
    const initialEvaluation = isEvaluation(item.evaluation) ? item.evaluation : undefined;
    let progress: RewriteProgress = { answer: initialAnswer, evaluation: initialEvaluation,
      lastEvaluated: initialEvaluation ? { answer: initialAnswer, evaluation: initialEvaluation } : undefined, pending: false, saved: true };
    try {
      const raw = storage()?.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw);
        if (typeof stored.answer === 'string') {
          const last = stored.lastEvaluated;
          const lastEvaluated = last && typeof last.answer === 'string' && isEvaluation(last.evaluation) ? last
            : isEvaluation(stored.evaluation) ? { answer: stored.answer, evaluation: stored.evaluation } : undefined;
          progress = { ...progress, answer: stored.answer, lastEvaluated,
            evaluation: lastEvaluated?.answer === stored.answer ? lastEvaluated.evaluation : undefined, editing: stored.editing === true };
        }
      }
    } catch { /* Corrupt/denied storage must not prevent opening an exercise. */ }
    entries.set(key, progress);
    return progress;
  };
  return {
    get,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    needsProtection: () => [...entries.values()].some(entry => entry.pending || !entry.saved),
    edit(key: string, item: RewritePracticeItem, answer: string) {
      const current = get(key, item);
      const next = persist(key, { ...current, answer, evaluation: current.lastEvaluated?.answer === answer ? current.lastEvaluated.evaluation : undefined, error: undefined });
      entries.set(key, next);
      emit();
    },
    beginEdit(key: string, item: RewritePracticeItem) {
      const current = get(key, item);
      if (current.pending || !current.lastEvaluated) return;
      entries.set(key, persist(key, { ...current, editing: true, error: undefined }));
      emit();
    },
    cancelEdit(key: string, item: RewritePracticeItem) {
      const current = get(key, item);
      if (current.pending || !current.lastEvaluated) return;
      entries.set(key, persist(key, { ...current, answer: current.lastEvaluated.answer,
        evaluation: current.lastEvaluated.evaluation, editing: false, error: undefined }));
      emit();
    },
    retrySave(key: string, item: RewritePracticeItem) {
      entries.set(key, persist(key, get(key, item)));
      emit();
    },
    async evaluate(key: string, item: RewritePracticeItem, evaluate: (answer: string) => Promise<RewriteEvaluation>) {
      const current = get(key, item);
      if (current.pending || !current.answer.trim()) return;
      // The exact evaluated draft already has a valid result; leaving edit mode
      // must not spend another AI request (including edit → undo → submit).
      if (current.lastEvaluated?.answer === current.answer) {
        entries.set(key, persist(key, { ...current, evaluation: current.lastEvaluated.evaluation,
          editing: false, error: undefined }));
        emit();
        return;
      }
      const answer = current.answer;
      entries.set(key, persist(key, { ...current, pending: true, error: undefined }));
      emit();
      try {
        const evaluation = await evaluate(answer.trim());
        if (!isEvaluation(evaluation)) throw new Error('评估结果不完整，请重试。');
        const latest = get(key, item);
        const matches = latest.answer === answer;
        entries.set(key, persist(key, { ...latest, pending: false,
          // Keep the last successful answer independently of an in-progress draft.
          lastEvaluated: { answer, evaluation },
          editing: matches ? false : latest.editing,
          evaluation: matches ? evaluation : undefined }));
      } catch (error) {
        const latest = get(key, item);
        entries.set(key, { ...latest, pending: false, error: error instanceof Error ? error.message : '评估暂不可用，请稍后重试' });
      } finally { emit(); }
    },
  };
}

function isEvaluation(value: unknown): value is RewriteEvaluation {
  if (!value || typeof value !== 'object') return false;
  const evaluation = value as RewriteEvaluation;
  return ['Excellent', 'Very Good', 'Good', 'Needs Improvement'].includes(evaluation.rating)
    && typeof evaluation.meaningPreserved === 'boolean' && typeof evaluation.targetUsedCorrectly === 'boolean'
    && Array.isArray(evaluation.whatYouDidWell) && evaluation.whatYouDidWell.every(point => typeof point === 'string')
    && Array.isArray(evaluation.issues) && evaluation.issues.every(issue => issue && typeof issue.original === 'string' && typeof issue.correction === 'string' && typeof issue.explanation === 'string')
    && typeof evaluation.improvedVersion === 'string' && typeof evaluation.referenceAnswer === 'string';
}

export const rewriteProgressStore = createRewriteProgressStore(() => typeof window === 'undefined' ? undefined : window.localStorage);

// Protect refresh/close only while a request is unfinished or storage failed.
// Successfully saved drafts do not obstruct normal navigation.
if (typeof window !== 'undefined') {
  const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
  let listening = false;
  rewriteProgressStore.subscribe(() => {
    const needed = rewriteProgressStore.needsProtection();
    if (needed === listening) return;
    listening = needed;
    if (needed) window.addEventListener('beforeunload', protect);
    else window.removeEventListener('beforeunload', protect);
  });
}
