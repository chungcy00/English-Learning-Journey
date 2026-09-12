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

  const localizedOriginalMeaning = getLocalizedExerciseMeaning(item, index, targetLanguage, currentTranslation);

  const handleCheck = async () => {
    if (!answer.trim() || loading) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const getRatingBadgeStyle = (rating: string) => {
    switch (rating) {
      case 'Excellent':
        return 'bg-[#73785E] text-[#F2EEE4]';
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
      {/* Question Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <span className="text-xs font-ui text-[#717265] uppercase tracking-wider block mb-1">
            {getI18nText(targetLanguage, 'exerciseLabel')} {index + 1}
          </span>
          <p className="font-editorial text-lg text-[#292B25] leading-snug">
            "{item.originalSentence}"
          </p>
          {localizedOriginalMeaning && (
            <p className="font-ui text-xs text-[#717265] mt-1.5 italic">
              {localizedOriginalMeaning}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <span className="text-[11px] font-ui text-[#717265] block">
            {getI18nText(targetLanguage, 'targetLabel')}:
          </span>
          <span className="inline-block font-editorial font-semibold text-sm px-2.5 py-0.5 bg-[#F2EEE4] text-[#5F654D] border border-[#D4CCBC] rounded-sm">
            {item.target}
          </span>
        </div>
      </div>

      {/* Answer Input */}
      <div className="mt-4">
        <label className="text-xs font-ui text-[#717265] block mb-1.5">
          {getI18nText(targetLanguage, 'rewritePromptPrefix')} ("{item.target}"):
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            placeholder={`${getI18nText(targetLanguage, 'inputPlaceholder')} (e.g. "${item.target}")`}
            className="flex-1 px-3 py-2 text-sm bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm focus:outline-none focus:border-[#73785E] font-editorial text-base text-[#292B25]"
          />
          <button
            onClick={handleCheck}
            disabled={!answer.trim() || loading}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#73785E] text-[#F2EEE4] text-xs font-medium font-ui rounded-sm hover:bg-[#73785E]/90 disabled:opacity-50 transition-colors shrink-0"
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
            className="text-[11px] text-[#717265] hover:text-[#5F654D] font-ui transition-colors uppercase tracking-widest"
          >
            {showAnswer ? 'Hide Answer' : 'Show Answer'}
          </button>
          
          {showAnswer && (
            <div className="mt-2 p-3 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC] text-xs font-ui animate-in fade-in">
              <span className="text-[11px] text-[#717265] block mb-1">
                {getI18nText(targetLanguage, 'referenceAnswer')}:
              </span>
              <p className="font-editorial text-sm text-[#5F654D]">
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-ui text-[#717265]">AI Rating:</span>
              <span className={`px-2.5 py-0.5 text-xs font-ui font-semibold rounded-xs ${getRatingBadgeStyle(evaluation.rating)}`}>
                {evaluation.rating}
              </span>
            </div>
            {evaluation.meaningPreserved && evaluation.targetUsedCorrectly && (
              <span className="text-xs text-[#5F654D] font-ui flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {getI18nText(targetLanguage, 'meaningPreserved')} & {getI18nText(targetLanguage, 'targetUsed')}
              </span>
            )}
          </div>

          {/* What You Did Well */}
          {evaluation.whatYouDidWell && evaluation.whatYouDidWell.length > 0 && (
            <div className="bg-[#F2EEE4]/80 p-3 rounded-sm border border-[#D4CCBC]/60">
              <span className="text-xs font-ui font-semibold text-[#5F654D] block mb-1">
                {getI18nText(targetLanguage, 'whatYouDidWell')}:
              </span>
              <ul className="text-xs font-ui text-[#292B25] space-y-1 list-disc list-inside">
                {evaluation.whatYouDidWell.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {/* What Needs Improvement (❌ original vs ✅ correction + explanation) */}
          {evaluation.issues && evaluation.issues.length > 0 && (
            <div className="bg-[#F2EEE4]/80 p-3 rounded-sm border border-[#D4CCBC]/60 space-y-2">
              <span className="text-xs font-ui font-semibold text-[#B49379] block">
                {getI18nText(targetLanguage, 'issuesToImprove')}:
              </span>
              {evaluation.issues.map((issue, idx) => (
                <div key={idx} className="text-xs font-ui space-y-0.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[#9E6554]">❌ {issue.original}</span>
                    <ArrowRight className="w-3 h-3 text-[#717265]" />
                    <span className="text-[#5F654D] font-medium">✅ {issue.correction}</span>
                  </div>
                  {issue.explanation && (
                    <p className="text-[11px] text-[#717265] pl-1">
                      {issue.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Improved Version & Reference Answer */}
          <div className="grid sm:grid-cols-2 gap-3 text-xs font-ui">
            <div className="p-2.5 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]">
              <span className="text-[11px] text-[#717265] block mb-0.5">
                {getI18nText(targetLanguage, 'improvedVersion')}:
              </span>
              <p className="font-editorial text-sm text-[#292B25] italic">
                "{evaluation.improvedVersion}"
              </p>
            </div>

            <div className="p-2.5 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]">
              <span className="text-[11px] text-[#717265] block mb-0.5">
                {getI18nText(targetLanguage, 'referenceAnswer')}:
              </span>
              <p className="font-editorial text-sm text-[#5F654D]">
                "{evaluation.referenceAnswer}"
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

