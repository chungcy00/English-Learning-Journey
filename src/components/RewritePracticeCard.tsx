import React, { useState } from 'react';
import { CheckCircle2, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { RewritePracticeItem, RewriteEvaluation, ReadingTranslation } from '../types';
import { evaluateRewriteAnswer } from '../services/api';
import { getI18nText, getLocalizedExerciseMeaning } from '../utils/i18n';

interface RewritePracticeCardProps {
  item: RewritePracticeItem;
  index: number;
  cefrLevel: string;
  targetLanguage?: string;
  currentTranslation?: ReadingTranslation;
  onAnswerChecked?: (itemId: string, userAnswer: string, evaluation: RewriteEvaluation) => void;
}

export const RewritePracticeCard: React.FC<RewritePracticeCardProps> = ({
  item,
  index,
  cefrLevel,
  targetLanguage = 'zh-CN',
  currentTranslation,
  onAnswerChecked,
}) => {
  const [answer, setAnswer] = useState(item.userAnswer || '');
  const [evaluation, setEvaluation] = useState<RewriteEvaluation | undefined>(item.evaluation);
  const [loading, setLoading] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localizedOriginalMeaning = getLocalizedExerciseMeaning(item, index, targetLanguage, currentTranslation);

  const handleCheck = async () => {
    if (!answer.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const evalResult = await evaluateRewriteAnswer({
        originalSentence: item.originalSentence,
        target: item.target,
        userAnswer: answer.trim(),
        referenceAnswer: item.referenceAnswer,
        cefrLevel,
        targetLanguage,
      });
      setEvaluation(evalResult);
      onAnswerChecked?.(item.id, answer.trim(), evalResult);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '评估暂不可用，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const getRatingBadgeStyle = (rating: string) => {
    switch (rating) {
      case 'Excellent':
        return 'bg-[#62694D] text-[#F2EEE4]';
      case 'Very Good':
        return 'bg-[#5F654D] text-[#F2EEE4]';
      case 'Good':
        return 'bg-[#B49379] text-[#F2EEE4]';
      case 'Needs Improvement':
      default:
        return 'bg-[#9E6554] text-[#F2EEE4]';
    }
  };

  return (
    <div className="bg-[#E5DED0]/40 border border-[#D4CCBC] rounded-sm p-5 sm:p-6 transition-all">
      {error && <p role="alert" className="type-body font-ui text-red-700 mb-3">{error}</p>}
      {/* Question Header */}
      <div className="exercise-heading mb-3">
        <div className="min-w-0 break-words">
          <span className="text-xs font-ui text-[#555848] uppercase tracking-wider block mb-1">
            {getI18nText(targetLanguage, 'exerciseLabel')} {index + 1}
          </span>
          <p className="type-example font-editorial text-[#292B25]">
            "{item.originalSentence}"
          </p>
          {localizedOriginalMeaning && (
            <p className="type-body font-ui text-[#555848] mt-1.5 italic">
              {localizedOriginalMeaning}
            </p>
          )}
        </div>

        <div className="exercise-target">
          <span className="text-sm font-ui font-semibold text-[#5F654D] block mb-1">
            {getI18nText(targetLanguage, 'targetLabel')}:
          </span>
          <span className="type-term inline-block font-editorial font-bold px-3 py-1 bg-[#F2EEE4] text-[#5F654D] border border-[#D4CCBC] rounded-sm">
            {item.target}
          </span>
        </div>
      </div>

      {/* Answer Input */}
      <div className="mt-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            aria-label={`${getI18nText(targetLanguage, 'exerciseLabel')} ${index + 1}：${getI18nText(targetLanguage, 'inputPlaceholder')}`}
            placeholder={getI18nText(targetLanguage, 'inputPlaceholder')}
            className="type-example min-w-0 min-h-11 flex-1 px-3 py-2 bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm focus:outline-none focus:border-[#62694D] text-[#292B25]"
          />
          <button
            onClick={handleCheck}
            disabled={!answer.trim() || loading}
            className="type-label min-h-11 flex items-center justify-center gap-1.5 px-4 py-2 bg-[#62694D] text-[#F2EEE4] font-medium font-ui rounded-sm hover:bg-[#5F654D] disabled:opacity-50 transition-colors shrink-0"
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
        </div>
      </div>

      {/* Show Answer Toggle for when not yet evaluated */}
      {!evaluation && (
        <div className="mt-3">
          <button 
            onClick={() => setShowAnswer(!showAnswer)}
            className="type-meta min-h-11 text-[#555848] hover:text-[#5F654D] font-ui transition-colors uppercase"
          >
            {showAnswer ? 'Hide Answer' : 'Show Answer'}
          </button>
          
          {showAnswer && (
            <div className="type-label mt-2 p-3 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC] font-ui animate-in fade-in">
              <span className="text-[11px] text-[#555848] block mb-1">
                {getI18nText(targetLanguage, 'referenceAnswer')}:
              </span>
              <p className="type-example font-editorial text-[#5F654D]">
                "{item.referenceAnswer}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Evaluation Section (PRD Sections 23-27) */}
      {evaluation && (
        <div className="mt-5 pt-4 border-t border-[#D4CCBC] space-y-4">
          {/* Rating Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="type-label font-ui text-[#555848]">AI Rating:</span>
              <span className={`type-label px-2.5 py-0.5 font-ui font-semibold rounded-xs ${getRatingBadgeStyle(evaluation.rating)}`}>
                {evaluation.rating}
              </span>
            </div>
            {evaluation.meaningPreserved && evaluation.targetUsedCorrectly && (
              <span className="type-label text-[#5F654D] font-ui flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {getI18nText(targetLanguage, 'meaningPreserved')} & {getI18nText(targetLanguage, 'targetUsed')}
              </span>
            )}
          </div>

          {/* What You Did Well */}
          {evaluation.whatYouDidWell && evaluation.whatYouDidWell.length > 0 && (
            <div className="bg-[#F2EEE4]/80 p-3 rounded-sm border border-[#D4CCBC]/60">
              <span className="type-label font-ui font-semibold text-[#5F654D] block mb-1">
                {getI18nText(targetLanguage, 'whatYouDidWell')}:
              </span>
              <ul className="type-body font-ui text-[#292B25] space-y-1 list-disc list-inside">
                {evaluation.whatYouDidWell.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {/* What Needs Improvement (❌ original vs ✅ correction + explanation) */}
          {evaluation.issues && evaluation.issues.length > 0 && (
            <div className="bg-[#F2EEE4]/80 p-3 rounded-sm border border-[#D4CCBC]/60 space-y-2">
              <span className="type-label font-ui font-semibold text-[#77543D] block">
                {getI18nText(targetLanguage, 'issuesToImprove')}:
              </span>
              {evaluation.issues.map((issue, idx) => (
                <div key={idx} className="type-body font-ui space-y-0.5">
                  <div className="flex flex-wrap items-center gap-3 break-words">
                    <span className="text-[#854C3C]">❌ {issue.original}</span>
                    <ArrowRight className="w-3 h-3 text-[#555848]" />
                    <span className="text-[#5F654D] font-medium">✅ {issue.correction}</span>
                  </div>
                  {issue.explanation && (
                    <p className="type-body text-[#555848] pl-1">
                      {issue.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Improved Version & Reference Answer */}
          <div className="type-label grid sm:grid-cols-2 gap-3 font-ui">
            <div className="p-2.5 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]">
              <span className="text-[11px] text-[#555848] block mb-0.5">
                {getI18nText(targetLanguage, 'improvedVersion')}:
              </span>
              <p className="type-example font-editorial text-[#292B25] italic">
                "{evaluation.improvedVersion}"
              </p>
            </div>

            <div className="p-2.5 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]">
              <span className="text-[11px] text-[#555848] block mb-0.5">
                {getI18nText(targetLanguage, 'referenceAnswer')}:
              </span>
              <p className="type-example font-editorial text-[#5F654D]">
                "{evaluation.referenceAnswer}"
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
