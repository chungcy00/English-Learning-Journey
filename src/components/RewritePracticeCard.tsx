import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Sparkles, Loader2, ArrowRight, ChevronDown, ChevronLeft, Pencil } from 'lucide-react';
import { RewritePracticeItem, ReadingTranslation } from '../types';
import { evaluateRewriteAnswer } from '../services/api';
import { getI18nText, getLocalizedExerciseMeaning } from '../utils/i18n';
import { rewriteProgressKey, rewriteProgressStore } from '../utils/rewriteProgress';
import { RewriteFeedback } from './RewriteFeedback';

interface RewritePracticeCardProps {
  readingId: string;
  item: RewritePracticeItem;
  index: number;
  total?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  cefrLevel: string;
  currentTranslation?: ReadingTranslation;
}

export const RewritePracticeCard: React.FC<RewritePracticeCardProps> = ({
  readingId,
  item,
  index,
  total = 1,
  onPrevious,
  onNext,
  nextLabel = '下一题',
  cefrLevel,
  currentTranslation,
}) => {
  const progressKey = rewriteProgressKey(readingId, item);
  const { answer, evaluation, lastEvaluated, editing, pending: loading, saved, error } = useSyncExternalStore(
    rewriteProgressStore.subscribe,
    () => rewriteProgressStore.get(progressKey, item),
    () => rewriteProgressStore.get(progressKey, item),
  );
  const editable = !evaluation || editing;
  const [showAnswer, setShowAnswer] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const ensureVisible = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = input.current;
        if (!element || document.activeElement !== element || viewport.scale !== 1) return;
        const rect = element.getBoundingClientRect();
        const nav = document.querySelector('.app-header')?.getBoundingClientRect();
        const top = Math.max(viewport.offsetTop, nav?.bottom ?? 0);
        const bottom = viewport.offsetTop + viewport.height;
        if (rect.bottom > bottom || rect.top < top) element.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      });
    };
    viewport.addEventListener('resize', ensureVisible);
    input.current?.addEventListener('focus', ensureVisible);
    const element = input.current;
    return () => { cancelAnimationFrame(frame); viewport.removeEventListener('resize', ensureVisible); element?.removeEventListener('focus', ensureVisible); };
  }, [editable]);

  const localizedOriginalMeaning = getLocalizedExerciseMeaning(item, index, currentTranslation);

  const handleCheck = async () => {
    await rewriteProgressStore.evaluate(progressKey, item, submittedAnswer => evaluateRewriteAnswer({
        originalSentence: item.originalSentence,
        target: item.target,
        userAnswer: submittedAnswer,
        referenceAnswer: item.referenceAnswer,
        cefrLevel,
      }));
  };

  const feedback = useRef<HTMLElement>(null);
  const wasPending = useRef(loading);
  const userScrolled = useRef(false);
  useEffect(() => {
    if (!loading) return;
    userScrolled.current = false;
    const markScroll = () => { userScrolled.current = true; };
    const markKey = (event: KeyboardEvent) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) markScroll(); };
    window.addEventListener('wheel', markScroll, { passive: true });
    window.addEventListener('touchmove', markScroll, { passive: true });
    window.addEventListener('keydown', markKey);
    return () => { window.removeEventListener('wheel', markScroll); window.removeEventListener('touchmove', markScroll); window.removeEventListener('keydown', markKey); };
  }, [loading]);
  useEffect(() => {
    if (wasPending.current && !loading && evaluation && !editing && !userScrolled.current) {
      feedback.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    wasPending.current = loading;
  }, [loading, evaluation, editing]);

  return (
    <div className="rewrite-exercise" id={`rewrite-exercise-${item.id}`}>
      {error && <p role="alert" className="type-body font-ui text-[var(--status-error)] mb-3">{error}</p>}
      <div className="rewrite-exercise-heading exercise-heading">
        <span className="rewrite-exercise-number">第 {index + 1} 题 / 共 {total} 题</span>
        <span className="rewrite-exercise-badge">{evaluation ? '已评估' : '改写练习'}</span>
      </div>
      <div className="exercise-target">
        <span className="rewrite-field-label">目标词汇</span>
        <h2 className="rewrite-target-term">{item.target}</h2>
      </div>
      <div className="rewrite-original">
        <span className="rewrite-field-label">原句</span>
        <p className="type-example font-ui">{item.originalSentence}</p>
        {localizedOriginalMeaning && <p className="type-translation font-ui text-[var(--text-secondary)] mt-1.5">{localizedOriginalMeaning}</p>}
      </div>
      <div className="rewrite-input-section">
        <div className="rewrite-answer-heading">
          {editable ? <label htmlFor={`rewrite-answer-${item.id}`} className="rewrite-input-label">你的改写</label> : <h3 className="rewrite-input-label">你的改写</h3>}
          {lastEvaluated && <button type="button" disabled={loading} className="rewrite-edit" onClick={() => editing ? rewriteProgressStore.cancelEdit(progressKey, item) : rewriteProgressStore.beginEdit(progressKey, item)}>
            {!editing && <Pencil aria-hidden="true" size={16} />}{editing ? '取消修改' : '修改'}
          </button>}
        </div>
        {editable ? <textarea ref={input} id={`rewrite-answer-${item.id}`} rows={4} value={answer}
          onChange={e => rewriteProgressStore.edit(progressKey, item, e.target.value)} disabled={loading}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handleCheck(); } }}
          aria-label={`第 ${index + 1} 题：你的改写`} placeholder="在这里输入你的英文改写…"
          className="rewrite-answer-input type-example font-ui min-w-0 min-h-11 flex-1" /> : <p className="rewrite-submitted-answer">{answer}</p>}
        {editing && lastEvaluated?.answer !== answer && <p role="status" className="rewrite-draft-notice">答案已修改，需要重新评估</p>}
        {(loading || !saved || editable && answer) && <div role="status" className="rewrite-save-status type-label font-ui text-[var(--text-secondary)]">
          {loading ? '正在评估，切换页面后可返回查看结果' : !saved ? <>
            无法保存到此设备；离开或刷新前请复制答案。
            <button type="button" onClick={() => rewriteProgressStore.retrySave(progressKey, item)} className="underline underline-offset-4 min-h-11 px-2">重试保存</button>
          </> : '已保存到此设备'}
        </div>}
      </div>
      {!evaluation && !lastEvaluated && <div className="rewrite-reference">
        <button type="button" onClick={() => setShowAnswer(!showAnswer)} aria-expanded={showAnswer} aria-controls={`rewrite-reference-${item.id}`} className="rewrite-show-answer">
          查看参考答案<ChevronDown aria-hidden="true" size={20} className={showAnswer ? 'rotate-180' : ''} />
        </button>
        {showAnswer && <p id={`rewrite-reference-${item.id}`} className="rewrite-reference-text">{item.referenceAnswer}</p>}
      </div>}
      {evaluation && !editing && <RewriteFeedback ref={feedback} evaluation={evaluation} />}
      {evaluation && !editing ? <button type="button" onClick={onNext} className="rewrite-check">
        {nextLabel}<ArrowRight aria-hidden="true" size={20} />
      </button> : <button type="button" onClick={handleCheck} disabled={!answer.trim() || loading} className="rewrite-check">
        {loading ? <Loader2 aria-hidden="true" size={20} className="animate-spin" /> : <Sparkles aria-hidden="true" size={20} />}
        <span>{loading ? getI18nText('evaluating') : lastEvaluated ? '重新评估' : getI18nText('checkButton')}</span>
      </button>}
      {onPrevious && <button type="button" onClick={onPrevious} className="rewrite-previous"><ChevronLeft aria-hidden="true" size={18} />返回上一题</button>}
    </div>
  );
};
