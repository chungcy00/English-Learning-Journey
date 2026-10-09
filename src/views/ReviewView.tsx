import React, { useState, useEffect, useRef } from 'react';
import { readReviewProgress, restoreReviewProgress, writeReviewProgress } from '../utils/reviewProgress';
import { Volume2, CheckCircle, ChevronDown } from 'lucide-react';
import { VocabularyItem, ReviewRating } from '../types';
import {
  getLocalizedVocabMeaning,
  getLocalizedExampleTranslation,
  getI18nText,
} from '../utils/i18n';
import { speakEnglishTerm } from '../utils/speech';
import { ReviewFlipCard } from '../components/ReviewFlipCard';
import { reviewIntervalDays } from '../utils/reviewSchedule';

interface ReviewViewProps {
  embedded?: boolean;
  allVocabularies: VocabularyItem[];
  onRate: (vocabId: string, rating: ReviewRating) => Promise<void>;
  onRefresh: () => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  allVocabularies,
  onRate,
  onRefresh,
  embedded = false,
}) => {
  const [initialProgress] = useState(readReviewProgress);
  const restored = restoreReviewProgress(allVocabularies.map(v => v.id), initialProgress);
  const [currentIndex, setCurrentIndex] = useState(restored.index);
  const [isRevealed, setIsRevealed] = useState(restored.revealed);
  const ratingBarRef = useRef<HTMLFieldSetElement>(null);
  const [sessionCompleted, setSessionCompleted] = useState(restored.completed);
  const initialized = useRef(allVocabularies.length > 0);
  const saving = useRef(false);
  const mounted = useRef(true);
  const [isSaving, setIsSaving] = useState(false);
  const [failedRating, setFailedRating] = useState<ReviewRating | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [reviewList, setReviewList] = useState<VocabularyItem[]>(allVocabularies);
  const activeId = useRef(reviewList[currentIndex]?.id);
  activeId.current = reviewList[currentIndex]?.id;
  const previousIds = useRef(allVocabularies.map(item => item.id));

  // Keep this session's order stable. Rating moves an item's due date forward;
  // replacing the list with the shortened due list here would skip the next card.
  useEffect(() => {
    const nextIndex = allVocabularies.findIndex(item => item.id === activeId.current);
    if (initialized.current && nextIndex >= 0) setCurrentIndex(nextIndex);
    if (allVocabularies.some(item => !previousIds.current.includes(item.id))) setSessionCompleted(false);
    previousIds.current = allVocabularies.map(item => item.id);
    setReviewList(allVocabularies);
    if (!initialized.current && allVocabularies.length) {
      const progress = restoreReviewProgress(allVocabularies.map(v => v.id), initialProgress);
      setCurrentIndex(progress.index);
      setIsRevealed(progress.revealed);
      setSessionCompleted(progress.completed);
      initialized.current = true;
    }
  }, [allVocabularies]);

  useEffect(() => {
    setCurrentIndex(index => Math.max(0, Math.min(index, Math.max(0, reviewList.length - 1))));
  }, [reviewList.length]);

  const currentVocab = reviewList[currentIndex];
  useEffect(() => {
    if (currentVocab && initialized.current) writeReviewProgress({ currentId: currentVocab.id,
      revealed: isRevealed, completed: sessionCompleted, ids: reviewList.map(v => v.id) });
  }, [currentVocab?.id, isRevealed, sessionCompleted, reviewList]);
  useEffect(() => { setFailedRating(null); }, [currentVocab?.id]);


  const handleStartReviewAll = () => {
    setReviewList(allVocabularies);
    setCurrentIndex(0);
    setIsRevealed(false);
    setSessionCompleted(false);
  };

  const handleRefreshReviews = () => {
    setReviewList(allVocabularies);
    setCurrentIndex(0);
    setIsRevealed(false);
    setSessionCompleted(false);
    onRefresh();
  };

  const handleRating = async (rating: ReviewRating) => {
    if (!currentVocab || saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setFailedRating(null);
    try {
      await onRate(currentVocab.id, rating);
      const nextIndex = Math.min(currentIndex + 1, reviewList.length - 1);
      const completed = currentIndex + 1 >= reviewList.length;
      writeReviewProgress({ currentId: reviewList[nextIndex].id, revealed: false, completed, ids: reviewList.map(v => v.id) });
      if (mounted.current) {
        setIsRevealed(false);
        setCurrentIndex(nextIndex);
        setSessionCompleted(completed);
      }
    } catch {
      if (mounted.current) setFailedRating(rating);
    } finally {
      saving.current = false;
      if (mounted.current) setIsSaving(false);
    }
  };

  const playVoice = (term: string) => {
    speakEnglishTerm(term);
  };


  const localizedMeaning = currentVocab ? getLocalizedVocabMeaning(currentVocab) : '';
  const localizedExample = currentVocab ? getLocalizedExampleTranslation(currentVocab) : undefined;

  useEffect(() => {
    const bar = ratingBarRef.current;
    const shell = bar?.closest<HTMLElement>('.review-shell');
    if (!bar || !shell) return;
    // Reserve the real height, including localized hints and text scaling.
    const measure = () => shell.style.setProperty('--review-rating-height', `${bar.getBoundingClientRect().height}px`);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(bar);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      shell.style.removeProperty('--review-rating-height');
    };
  }, [isRevealed, sessionCompleted, reviewList.length]);

  const Heading = embedded ? 'h2' : 'h1';
  return (
    <div className={`${embedded ? 'review-embedded' : 'page-shell page-shell--review'} page-stack review-page`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <Heading className="type-page font-editorial font-semibold text-[var(--text-primary)]">
            {embedded ? '词汇复习' : getI18nText('reviewTitle')}
          </Heading>
          <p className="type-body font-ui text-[var(--text-secondary)] mt-2">当前短文已添加词条：{reviewList.length} 项</p>
        </div>
      </div>

      {/* When finished or the wordbook is empty */}
      {sessionCompleted || reviewList.length === 0 ? (
        <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-sm p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-alt)] flex items-center justify-center text-[var(--accent-primary)]">
            <CheckCircle className="w-6 h-6" />
          </div>

          <h2 className="font-editorial text-[length:var(--type-section)] leading-[1.3] font-semibold text-[var(--text-primary)]">
            {allVocabularies.length === 0 ? '当前短文还没有已添加词条' : '本轮复习已完成！'}
          </h2>
          {allVocabularies.length === 0 && <p className="type-body font-ui text-[var(--text-secondary)] max-w-md mx-auto">
            在当前阅读页或生词本添加表达后，即可在这里复习。
          </p>}

          <div className="pt-4 flex flex-wrap justify-center gap-3">
            {allVocabularies.length > 0 && (
              <button
                onClick={handleStartReviewAll}
                className="type-label px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-primary)] font-ui font-medium rounded-sm hover:bg-[var(--accent-hover)] transition-colors"
              >
                重新复习当前短文 ({allVocabularies.length})
              </button>
            )}
            <button
              onClick={handleRefreshReviews}
              className="type-label px-4 py-2 bg-[var(--bg-alt)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-ui rounded-sm hover:bg-[var(--bg-alt)]/80 transition-colors"
            >
              刷新复习状态
            </button>
          </div>
        </div>
      ) : (
        /* Active Flashcard */
        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="review-progress type-label flex flex-wrap items-center justify-end gap-x-4 gap-y-2 font-ui text-[var(--text-secondary)]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                  setIsRevealed(false);
                }}
                disabled={isSaving || currentIndex === 0}
                className="min-h-11 min-w-11 px-2 py-1 rounded-xs hover:bg-[var(--bg-alt)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
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
                disabled={isSaving || currentIndex === reviewList.length - 1}
                className="min-h-11 min-w-11 px-2 py-1 rounded-xs hover:bg-[var(--bg-alt)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                Next &rarr;
              </button>
            </div>
          </div>

          {/* Flashcard Card (PRD Section 28) */}
          <ReviewFlipCard revealed={isRevealed} disabled={isSaving} onFlip={() => setIsRevealed(value => !value)} front={<div className="review-flashcard review-front-card p-6 sm:p-10">
            <button type="button" aria-label={`播放 ${currentVocab.term} 的发音`} onClick={() => playVoice(currentVocab.term)} className="min-h-11 min-w-11 flex items-center justify-center ml-auto rounded-sm hover:bg-[var(--bg-alt)]"><Volume2 aria-hidden="true" className="w-4 h-4" /></button>
            <h2 className="font-editorial font-semibold text-[var(--accent-vocab)] text-center break-words">{currentVocab.term}</h2>
            <p className="type-label font-ui text-[var(--text-secondary)] text-center mt-2">{currentVocab.phonetic} · {currentVocab.partOfSpeech}</p>
          </div>}>
          <div className="review-flashcard bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-sm p-6 sm:p-10 flex flex-col justify-between">
            {/* Front: Term & Phonetic */}
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playVoice(currentVocab.term)}
                    title="朗读发音"
                    aria-label={`播放 ${currentVocab.term} 的发音`}
                    className="min-h-11 min-w-11 flex items-center justify-center p-1.5 text-[var(--accent-primary)] hover:bg-[var(--bg-alt)] rounded-xs transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-center py-4">
                <h2 className="font-editorial text-[length:var(--type-term)] leading-[1.4]  font-semibold text-[var(--accent-vocab)] tracking-tight break-words">
                  {currentVocab.term}
                </h2>
                <p className="type-meta font-ui text-[var(--text-muted)] mt-1">
                  {currentVocab.phonetic} •{' '}
                  <span className="type-label italic">{currentVocab.partOfSpeech}</span>
                </p>
              </div>

              {/* Revealable Details */}
              {(
                <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)] text-left animate-fadeIn">
                  {/* Localized Meaning */}
                  <div>
                    <span className="type-meta font-ui text-[var(--text-muted)] block uppercase">
                      {getI18nText('targetMeaningLabel', '母语地道释义 (Meaning)')}:
                    </span>
                    <p className="font-ui text-[length:var(--type-translation)] leading-[1.6] font-semibold text-[var(--text-primary)] mt-0.5">
                      {localizedMeaning}
                    </p>
                  </div>

                  {/* English Definition */}
                  <div>
                    <span className="type-meta font-ui text-[var(--text-muted)] block uppercase">
                      {getI18nText('enDefinitionLabel', '英文释义 (Definition)')}:
                    </span>
                    <p className="type-translation font-editorial text-[var(--text-primary)]">
                      {currentVocab.definitionEn}
                    </p>
                  </div>

                  {/* Example & Localized Example Translation */}
                  <div>
                    <span className="type-meta font-ui text-[var(--text-muted)] block uppercase">
                      {getI18nText('exampleLabel', '例句 (Example)')}:
                    </span>
                    <div className="bg-[var(--bg-alt)]/40 p-2.5 rounded-sm border border-[var(--border-subtle)] mt-1 space-y-1">
                      <p className="type-example font-editorial italic text-[var(--accent-vocab)]">
                        "{currentVocab.example}"
                      </p>
                      {localizedExample && (
                        <p className="type-translation font-ui text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]/40">
                          {localizedExample}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Collocations */}
                  {currentVocab.collocations && currentVocab.collocations.length > 0 && (
                    <details key={currentVocab.id} className="review-collocations group">
                      <summary className="type-label min-h-11 flex items-center justify-between font-ui text-[var(--text-secondary)] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        {getI18nText('collocationsLabel', '常见搭配 (Collocations)')}:
                        <ChevronDown aria-hidden="true" className="w-4 h-4 group-open:rotate-180" />
                      </summary>
                      <div className="flex flex-wrap gap-1.5">
                        {currentVocab.collocations.map((col, idx) => (
                          <span
                            key={idx}
                            className="type-example font-editorial px-2 py-0.5 bg-[var(--bg-alt)] text-[var(--text-primary)] rounded-xs border border-[var(--border-subtle)]"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>

            {/* Rating Buttons (PRD Section 29) */}
            {isRevealed && (
              <fieldset ref={ratingBarRef} disabled={isSaving} aria-label="评价记忆程度" className="review-rating-bar mt-8 pt-4 border-t border-[var(--border-subtle)] grid grid-cols-4 gap-2 disabled:opacity-60">
                <button
                  onClick={() => handleRating('Again')}
                  className="min-h-14 py-2.5 px-2 bg-[var(--status-error)]/10 hover:bg-[var(--status-error)]/20 border border-[var(--status-error)]/30 rounded-sm text-center transition-colors"
                >
                  <span className="type-label font-ui font-semibold text-[var(--status-error)] block">Again</span>
                  <span className="type-meta text-[var(--text-muted)] font-ui block">
                    30 分钟后
                  </span>
                </button>

                <button
                  onClick={() => handleRating('Hard')}
                  className="min-h-14 py-2.5 px-2 bg-[var(--accent-warm)]/15 hover:bg-[var(--accent-warm)]/25 border border-[var(--accent-warm)]/30 rounded-sm text-center transition-colors"
                >
                  <span className="type-label font-ui font-semibold text-[var(--status-warning)] block">Hard</span>
                  <span className="type-meta text-[var(--text-muted)] font-ui block">
                    {getI18nText('hardHint', '1 天后')}
                  </span>
                </button>

                <button
                  onClick={() => handleRating('Good')}
                  className="min-h-14 py-2.5 px-2 bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 rounded-sm text-center transition-colors"
                >
                  <span className="type-label font-ui font-semibold text-[var(--accent-vocab)] block">Good</span>
                  <span className="type-meta text-[var(--text-muted)] font-ui block">
                    {reviewIntervalDays('Good', currentVocab.currentInterval)} 天后
                  </span>
                </button>

                <button
                  onClick={() => handleRating('Easy')}
                  className="min-h-14 py-2.5 px-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] border border-[var(--accent-primary)] rounded-sm text-center transition-colors"
                >
                  <span className="type-label font-ui font-semibold text-[var(--bg-primary)] block">Easy</span>
                  <span className="type-meta text-[var(--bg-primary)] font-ui block">
                    {reviewIntervalDays('Easy', currentVocab.currentInterval)} 天后
                  </span>
                </button>
              </fieldset>
            )}
            {isSaving && <p role="status" className="type-body font-ui text-[var(--text-secondary)] mt-3">正在保存评分，请稍候…</p>}
            {failedRating && <div role="alert" className="font-ui text-[length:var(--type-body)] leading-[1.6] text-[var(--status-error)] mt-3">
              <p>评分未保存，当前词条已保留。请检查设备存储后重试。</p>
              <button onClick={() => handleRating(failedRating)} className="min-h-11 px-3 border rounded-sm mt-2">重试保存</button>
            </div>}
          </div>
          </ReviewFlipCard>
        </div>
      )}
    </div>
  );
};
