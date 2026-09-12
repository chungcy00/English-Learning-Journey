import React, { useState, useEffect } from 'react';
import { RotateCcw, Volume2, CheckCircle, Sparkles, BookOpen, Check, Languages, Loader2 } from 'lucide-react';
import { VocabularyItem, ReviewRating } from '../types';
import {
  SUPPORTED_LANGUAGES,
  getLocalizedVocabMeaning,
  getLocalizedExampleTranslation,
  getI18nText,
} from '../utils/i18n';
import { translateVocabularies } from '../services/api';

interface ReviewViewProps {
  dueVocabularies: VocabularyItem[];
  allVocabularies: VocabularyItem[];
  onRate: (vocabId: string, rating: ReviewRating) => void;
  onRefresh: () => void;
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
  onBatchUpdateVocabularies: (updatedVocabs: VocabularyItem[]) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  dueVocabularies,
  allVocabularies,
  onRate,
  onRefresh,
  targetLanguage,
  onLanguageChange,
  onBatchUpdateVocabularies,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [reviewList, setReviewList] = useState<VocabularyItem[]>(dueVocabularies);
  const [isTranslatingCurrent, setIsTranslatingCurrent] = useState(false);

  // Sync reviewList when dueVocabularies updates
  useEffect(() => {
    setReviewList(dueVocabularies);
  }, [dueVocabularies]);

  const currentVocab = reviewList[currentIndex];

  // Auto translate current vocabulary item if targetLanguage is not zh-CN and translation is missing
  useEffect(() => {
    if (!currentVocab || !targetLanguage || targetLanguage === 'zh-CN') return;
    if (currentVocab.translations?.[targetLanguage]?.meaning) return;

    let isMounted = true;
    setIsTranslatingCurrent(true);

    translateVocabularies([currentVocab], targetLanguage)
      .then((results) => {
        if (!isMounted || !results) return;
        const tr = results[currentVocab.id] || results[currentVocab.term.toLowerCase()];
        if (tr) {
          const updatedItem: VocabularyItem = {
            ...currentVocab,
            translations: {
              ...currentVocab.translations,
              [targetLanguage]: tr,
            },
          };
          onBatchUpdateVocabularies([updatedItem]);
          setReviewList((prev) =>
            prev.map((item) => (item.id === currentVocab.id ? updatedItem : item))
          );
        }
      })
      .catch((err) => console.warn('Review vocab translate failed:', err))
      .finally(() => {
        if (isMounted) setIsTranslatingCurrent(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentVocab?.id, targetLanguage]);

  // Allow reviewing all words if no words are strictly due
  const handleStartReviewAll = () => {
    setReviewList(allVocabularies);
    setCurrentIndex(0);
    setIsRevealed(false);
    setSessionCompleted(false);
  };

  const handleRating = (rating: ReviewRating) => {
    if (!currentVocab) return;

    onRate(currentVocab.id, rating);

    setIsRevealed(false);
    if (currentIndex + 1 < reviewList.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setSessionCompleted(true);
      onRefresh();
    }
  };

  const playVoice = (term: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(term);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage) || SUPPORTED_LANGUAGES[0];

  const localizedMeaning = currentVocab ? getLocalizedVocabMeaning(currentVocab, targetLanguage) : '';
  const localizedExample = currentVocab ? getLocalizedExampleTranslation(currentVocab, targetLanguage) : undefined;
  const isNotZh = targetLanguage !== 'zh-CN';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D4CCBC]">
        <div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#292B25]">
            {getI18nText(targetLanguage, 'reviewTitle')}
          </h1>
          <p className="text-xs font-ui text-[#717265] mt-1">
            {getI18nText(targetLanguage, 'reviewSub')}
          </p>
        </div>

        {/* Target Language Selector */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-[#F2EEE4] border border-[#D4CCBC] px-2.5 py-1.5 rounded-sm">
          <Languages className="w-3.5 h-3.5 text-[#5F654D]" />
          <select
            value={targetLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="bg-transparent text-xs font-ui font-medium text-[#292B25] focus:outline-none cursor-pointer"
            title="切换复习释义语言"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.native}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* When finished or no due words */}
      {sessionCompleted || reviewList.length === 0 ? (
        <div className="bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#E5DED0] flex items-center justify-center text-[#73785E]">
            <CheckCircle className="w-6 h-6" />
          </div>

          <h2 className="font-editorial text-2xl font-semibold text-[#292B25]">
            {getI18nText(targetLanguage, 'todayCompleted', '今日复习已全部完成！')}
          </h2>
          <p className="text-xs font-ui text-[#717265] max-w-md mx-auto">
            您已经完成当前所有到期的复习词汇。坚持复习能让词汇在真实语境中自然内化。
          </p>

          <div className="pt-4 flex flex-wrap justify-center gap-3">
            {allVocabularies.length > 0 && (
              <button
                onClick={handleStartReviewAll}
                className="px-4 py-2 bg-[#73785E] text-[#F2EEE4] font-ui text-xs font-medium rounded-sm hover:bg-[#73785E]/90 transition-colors"
              >
                自由复习全部生词 ({allVocabularies.length})
              </button>
            )}
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-[#E5DED0] text-[#292B25] border border-[#D4CCBC] font-ui text-xs rounded-sm hover:bg-[#E5DED0]/80 transition-colors"
            >
              刷新复习状态
            </button>
          </div>
        </div>
      ) : (
        /* Active Flashcard */
        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-xs font-ui text-[#717265]">
            <span>Today's Review: {reviewList.length} Words</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                  setIsRevealed(false);
                }}
                disabled={currentIndex === 0}
                className="px-2 py-1 rounded-xs hover:bg-[#E5DED0] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                &larr; Prev
              </button>
              <span className="font-medium">
                {currentIndex + 1} / {reviewList.length}
              </span>
              <button
                onClick={() => {
                  setCurrentIndex((prev) => Math.min(reviewList.length - 1, prev + 1));
                  setIsRevealed(false);
                }}
                disabled={currentIndex === reviewList.length - 1}
                className="px-2 py-1 rounded-xs hover:bg-[#E5DED0] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                Next &rarr;
              </button>
            </div>
          </div>

          {/* Flashcard Card (PRD Section 28) */}
          <div className="bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm p-6 sm:p-10 shadow-sm min-h-[320px] flex flex-col justify-between">
            {/* Front: Term & Phonetic */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-ui uppercase tracking-wider text-[#717265]">
                  Word {currentIndex + 1}
                </span>
                <div className="flex items-center gap-2">
                  {isTranslatingCurrent && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-ui text-[#5F654D] animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      翻译释义中...
                    </span>
                  )}
                  <button
                    onClick={() => playVoice(currentVocab.term)}
                    title="朗读发音"
                    className="p-1.5 text-[#73785E] hover:bg-[#E5DED0] rounded-xs transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-center py-4">
                <h2 className="font-editorial text-4xl sm:text-5xl font-semibold text-[#5F654D] tracking-tight">
                  {currentVocab.term}
                </h2>
                <p className="text-sm font-ui text-[#717265] mt-1">
                  {currentVocab.phonetic} •{' '}
                  <span className="italic">{currentVocab.partOfSpeech}</span>
                </p>
              </div>

              {/* Revealable Details */}
              {isRevealed ? (
                <div className="space-y-4 pt-4 border-t border-[#D4CCBC] text-left animate-fadeIn">
                  {/* Localized Meaning */}
                  <div>
                    <span className="text-[11px] font-ui text-[#717265] block uppercase">
                      {getI18nText(targetLanguage, 'targetMeaningLabel', '母语地道释义 (Meaning)')}:
                    </span>
                    <p className="font-ui text-base font-semibold text-[#292B25] mt-0.5">
                      {localizedMeaning}
                    </p>
                    {isNotZh && currentVocab.meaningZh && localizedMeaning !== currentVocab.meaningZh && (
                      <p className="text-xs font-ui text-[#717265] mt-0.5">
                        (中文参考: {currentVocab.meaningZh})
                      </p>
                    )}
                  </div>

                  {/* English Definition */}
                  <div>
                    <span className="text-[11px] font-ui text-[#717265] block uppercase">
                      {getI18nText(targetLanguage, 'enDefinitionLabel', '英文释义 (Definition)')}:
                    </span>
                    <p className="font-editorial text-base text-[#292B25] leading-relaxed">
                      {currentVocab.definitionEn}
                    </p>
                  </div>

                  {/* Example & Localized Example Translation */}
                  <div>
                    <span className="text-[11px] font-ui text-[#717265] block uppercase">
                      {getI18nText(targetLanguage, 'exampleLabel', '例句 (Example)')}:
                    </span>
                    <div className="bg-[#E5DED0]/40 p-2.5 rounded-sm border-l-2 border-[#73785E] mt-1 space-y-1">
                      <p className="font-editorial text-base italic text-[#5F654D]">
                        "{currentVocab.example}"
                      </p>
                      {localizedExample && (
                        <p className="text-xs font-ui text-[#717265] pt-1 border-t border-[#D4CCBC]/40">
                          {localizedExample}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Collocations */}
                  {currentVocab.collocations && currentVocab.collocations.length > 0 && (
                    <div>
                      <span className="text-[11px] font-ui text-[#717265] block uppercase mb-1">
                        {getI18nText(targetLanguage, 'collocationsLabel', '常见搭配 (Collocations)')}:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentVocab.collocations.map((col, idx) => (
                          <span
                            key={idx}
                            className="text-xs font-editorial px-2 py-0.5 bg-[#E5DED0] text-[#292B25] rounded-xs border border-[#D4CCBC]"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <button
                    onClick={() => setIsRevealed(true)}
                    className="px-6 py-2.5 bg-[#E5DED0] hover:bg-[#E5DED0]/80 text-[#292B25] text-xs font-ui font-medium border border-[#D4CCBC] rounded-sm transition-colors"
                  >
                    {getI18nText(targetLanguage, 'revealDetails', '显示详细释义与例句 (Reveal Details)')}
                  </button>
                </div>
              )}
            </div>

            {/* Rating Buttons (PRD Section 29) */}
            {isRevealed && (
              <div className="mt-8 pt-4 border-t border-[#D4CCBC] grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleRating('Again')}
                  className="py-2.5 px-2 bg-[#9E6554]/10 hover:bg-[#9E6554]/20 border border-[#9E6554]/30 rounded-sm text-center transition-colors"
                >
                  <span className="font-ui text-xs font-semibold text-[#9E6554] block">Again</span>
                  <span className="text-[10px] text-[#717265] font-ui block">
                    {getI18nText(targetLanguage, 'againHint', '今天再复习')}
                  </span>
                </button>

                <button
                  onClick={() => handleRating('Hard')}
                  className="py-2.5 px-2 bg-[#B49379]/15 hover:bg-[#B49379]/25 border border-[#B49379]/30 rounded-sm text-center transition-colors"
                >
                  <span className="font-ui text-xs font-semibold text-[#B49379] block">Hard</span>
                  <span className="text-[10px] text-[#717265] font-ui block">
                    {getI18nText(targetLanguage, 'hardHint', '1 天后')}
                  </span>
                </button>

                <button
                  onClick={() => handleRating('Good')}
                  className="py-2.5 px-2 bg-[#73785E]/15 hover:bg-[#73785E]/25 border border-[#73785E]/30 rounded-sm text-center transition-colors"
                >
                  <span className="font-ui text-xs font-semibold text-[#5F654D] block">Good</span>
                  <span className="text-[10px] text-[#717265] font-ui block">
                    {getI18nText(targetLanguage, 'goodHint', '3 天后')}
                  </span>
                </button>

                <button
                  onClick={() => handleRating('Easy')}
                  className="py-2.5 px-2 bg-[#73785E] hover:bg-[#73785E]/90 border border-[#73785E] rounded-sm text-center transition-colors"
                >
                  <span className="font-ui text-xs font-semibold text-[#F2EEE4] block">Easy</span>
                  <span className="text-[10px] text-[#F2EEE4]/80 font-ui block">
                    {getI18nText(targetLanguage, 'easyHint', '7 天后')}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
