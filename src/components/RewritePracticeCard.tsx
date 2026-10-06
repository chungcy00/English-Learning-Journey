import React, { useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { RewritePracticeItem, ReadingTranslation } from '../types';
import { evaluateRewriteAnswer } from '../services/api';
import { getI18nText, getLocalizedExerciseMeaning } from '../utils/i18n';
import { rewriteProgressKey, rewriteProgressStore } from '../utils/rewriteProgress';

interface RewritePracticeCardProps {
  readingId: string;
  item: RewritePracticeItem;
  index: number;
  cefrLevel: string;
  targetLanguage?: string;
  currentTranslation?: ReadingTranslation;
}

export const RewritePracticeCard: React.FC<RewritePracticeCardProps> = ({
  readingId,
  item,
  index,
  cefrLevel,
  targetLanguage = 'zh-CN',
  currentTranslation,
}) => {
  const progressKey = rewriteProgressKey(readingId, item);
  const { answer, evaluation, pending: loading, saved, error } = useSyncExternalStore(
    rewriteProgressStore.subscribe,
    () => rewriteProgressStore.get(progressKey, item),
    () => rewriteProgressStore.get(progressKey, item),
  );
  const [showAnswer, setShowAnswer] = useState(false);

  const localizedOriginalMeaning = getLocalizedExerciseMeaning(item, index, targetLanguage, currentTranslation);

  const handleCheck = async () => {
    await rewriteProgressStore.evaluate(progressKey, item, submittedAnswer => evaluateRewriteAnswer({
        originalSentence: item.originalSentence,
        target: item.target,
        userAnswer: submittedAnswer,
        referenceAnswer: item.referenceAnswer,
        cefrLevel,
        targetLanguage,
      }));
  };

  const getRatingBadgeStyle = (rating: string) => {
    switch (rating) {
      case 'Excellent':
        return 'bg-[var(--accent-primary)] text-[var(--bg-primary)]';
      case 'Very Good':
        return 'bg-[var(--accent-vocab)] text-[var(--bg-primary)]';
      case 'Good':
        return 'bg-[#B49379]/20 text-[#77543D]';
      case 'Needs Improvement':
      default:
        return 'bg-[#9E6554] text-[var(--bg-primary)]';
    }
  };

  return (
    <div className="rewrite-exercise" id={`rewrite-exercise-${item.id}`}>
      {error && <p role="alert" className="type-body font-ui text-red-700 mb-3">{error}</p>}
      {/* Question Header */}
      <div className="rewrite-exercise-heading exercise-heading mb-3">
        <span className="rewrite-exercise-number type-label font-ui text-[var(--text-secondary)]">
          {getI18nText(targetLanguage, 'exerciseLabel')} {String(index + 1).padStart(2, '0')}
        </span>
        <div className="exercise-target flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-sm font-ui font-semibold text-[var(--accent-vocab)] block mb-1">
            {getI18nText(targetLanguage, 'targetLabel')}:
          </span>
          <span className="rewrite-target-term inline-block font-editorial font-semibold text-[var(--accent-vocab)]">
            {item.target}
          </span>
        </div>
      </div>

      <div className="rewrite-original">
        <span className="type-label font-ui text-[var(--text-secondary)]">原句</span>
        <p className="type-example font-editorial text-[var(--text-primary)]">{item.originalSentence}</p>
        {localizedOriginalMeaning && <p className="type-body font-ui text-[var(--text-secondary)] mt-1.5">{localizedOriginalMeaning}</p>}
      </div>

      {/* Answer Input */}
      <div className="mt-4">
        <label htmlFor={`rewrite-answer-${item.id}`} className="type-label font-ui block mb-2">你的改写</label>
        <div className="rewrite-answer-controls">
          <textarea
            id={`rewrite-answer-${item.id}`}
            rows={2}
            value={answer}
            onChange={(e) => rewriteProgressStore.edit(progressKey, item, e.target.value)}
            disabled={loading}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handleCheck(); } }}
            aria-label={`${getI18nText(targetLanguage, 'exerciseLabel')} ${index + 1}：${getI18nText(targetLanguage, 'inputPlaceholder')}`}
            placeholder={getI18nText(targetLanguage, 'inputPlaceholder')}
            className="type-body font-ui min-w-0 min-h-11 flex-1 px-3 py-2 bg-[var(--surface-paper)] border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:border-[var(--accent-primary)] text-[var(--text-primary)]"
          />
          <button
            onClick={handleCheck}
            disabled={!answer.trim() || loading}
            className="rewrite-check type-label min-h-11 flex items-center justify-center gap-1.5 px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-primary)] font-medium font-ui rounded-sm hover:bg-[var(--accent-vocab)] disabled:opacity-50 transition-colors shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{getI18nText(targetLanguage, 'evaluating')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{getI18nText(targetLanguage, 'checkButton')}</span>
              </>
            )}
          </button>
          {!evaluation && <button type="button" onClick={() => setShowAnswer(!showAnswer)} aria-expanded={showAnswer}
            className="rewrite-show-answer type-label min-h-11 font-ui text-[var(--text-secondary)] underline underline-offset-4">
            {showAnswer ? '收起参考答案' : '查看参考答案'}
          </button>}
        </div>
        <div role="status" className="type-label font-ui text-[var(--text-secondary)] mt-2">
          {loading ? '正在评估，切换页面后可返回查看结果' : !saved ? (
            <>无法保存到此设备；离开或刷新前请复制答案。
              <button type="button" onClick={() => rewriteProgressStore.retrySave(progressKey, item)} className="underline underline-offset-4 min-h-11 px-2">重试保存</button>
            </>
          ) : answer ? '已保存到此设备' : null}
        </div>
      </div>

      {/* Show Answer Toggle for when not yet evaluated */}
      {!evaluation && showAnswer && (
        <div className="rewrite-reference mt-3">
          {showAnswer && (
            <div className="type-label mt-2 p-3 bg-[var(--bg-primary)] rounded-sm border border-[var(--border-subtle)] font-ui animate-in fade-in">
              <span className="text-[11px] text-[var(--text-secondary)] block mb-1">
                {getI18nText(targetLanguage, 'referenceAnswer')}:
              </span>
              <p className="type-example font-editorial text-[var(--accent-vocab)]">
                "{item.referenceAnswer}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Evaluation Section (PRD Sections 23-27) */}
      {evaluation && (
        <div className="rewrite-feedback mt-5 pt-4 border-t border-[var(--border-subtle)] space-y-4">
          {/* Rating Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="type-label font-ui text-[var(--text-secondary)]">AI Rating:</span>
              <span className={`type-label px-2.5 py-0.5 font-ui font-semibold rounded-xs ${getRatingBadgeStyle(evaluation.rating)}`}>
                {evaluation.rating}
              </span>
            </div>
            {evaluation.meaningPreserved && evaluation.targetUsedCorrectly && (
              <span className="type-label text-[var(--accent-vocab)] font-ui flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {getI18nText(targetLanguage, 'meaningPreserved')} & {getI18nText(targetLanguage, 'targetUsed')}
              </span>
            )}
          </div>

          {/* What You Did Well */}
          {evaluation.whatYouDidWell && evaluation.whatYouDidWell.length > 0 && (
            <div className="bg-[var(--bg-primary)]/80 p-3 rounded-sm border border-[var(--border-subtle)]/60">
              <span className="type-label font-ui font-semibold text-[var(--accent-vocab)] block mb-1">
                {getI18nText(targetLanguage, 'whatYouDidWell')}:
              </span>
              <ul className="type-body font-ui text-[var(--text-primary)] space-y-1 list-disc list-inside">
                {evaluation.whatYouDidWell.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {/* What Needs Improvement (❌ original vs ✅ correction + explanation) */}
          {evaluation.issues && evaluation.issues.length > 0 && (
            <div className="bg-[var(--bg-primary)]/80 p-3 rounded-sm border border-[var(--border-subtle)]/60 space-y-2">
              <span className="type-label font-ui font-semibold text-[#77543D] block">
                {getI18nText(targetLanguage, 'issuesToImprove')}:
              </span>
              {evaluation.issues.map((issue, idx) => (
                <div key={idx} className="type-body font-ui space-y-0.5">
                  <div className="flex flex-wrap items-center gap-3 break-words">
                    <span className="text-[#854C3C]">原表达：{issue.original}</span>
                    <ArrowRight className="w-3 h-3 text-[var(--text-secondary)]" />
                    <span className="text-[var(--accent-vocab)] font-medium">建议：{issue.correction}</span>
                  </div>
                  {issue.explanation && (
                    <p className="type-body text-[var(--text-secondary)] pl-1">
                      {issue.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Improved Version & Reference Answer */}
          <div className="type-label grid sm:grid-cols-2 gap-3 font-ui">
            <div className="p-2.5 bg-[var(--bg-primary)] rounded-sm border border-[var(--border-subtle)]">
              <span className="text-[11px] text-[var(--text-secondary)] block mb-0.5">
                {getI18nText(targetLanguage, 'improvedVersion')}:
              </span>
              <p className="type-example font-editorial text-[var(--text-primary)] italic">
                "{evaluation.improvedVersion}"
              </p>
            </div>

            <div className="p-2.5 bg-[var(--bg-primary)] rounded-sm border border-[var(--border-subtle)]">
              <span className="text-[11px] text-[var(--text-secondary)] block mb-0.5">
                {getI18nText(targetLanguage, 'referenceAnswer')}:
              </span>
              <p className="type-example font-editorial text-[var(--accent-vocab)]">
                "{evaluation.referenceAnswer}"
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
