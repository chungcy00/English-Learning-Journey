import React, { useState, useEffect, useRef } from 'react';
import { readReviewProgress, restoreReviewProgress, writeReviewProgress } from '../utils/reviewProgress';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import type { VocabularyItem } from '../types';
import { getLocalizedVocabMeaning, getLocalizedExampleTranslation } from '../utils/i18n';
import { speakEnglishTerm } from '../utils/speech';
import { PracticeVocabularyCard } from '../components/PracticeVocabularyCard';

interface ReviewViewProps {
  embedded?: boolean;
  sessionKey?: string;
  scopeLabel?: string;
  allVocabularies: VocabularyItem[];
  onRefresh: () => void | Promise<void>;
}

/** Browse saved learning content without grading or changing the old review schedule. */
export const ReviewView: React.FC<ReviewViewProps> = ({ allVocabularies, onRefresh, embedded = false, sessionKey, scopeLabel }) => {
  const [initialProgress] = useState(() => readReviewProgress(sessionKey));
  const restored = restoreReviewProgress(allVocabularies.map(v => v.id), initialProgress);
  const [currentIndex, setCurrentIndex] = useState(restored.index);
  const [isRevealed, setIsRevealed] = useState(restored.revealed);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [reviewList, setReviewList] = useState<VocabularyItem[]>(allVocabularies);
  const activeId = useRef(reviewList[currentIndex]?.id);
  activeId.current = reviewList[currentIndex]?.id;
  const initialized = useRef(allVocabularies.length > 0);
  const refreshLock = useRef(false);
  const mounted = useRef(true);
  const scopeHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (scopeLabel) scopeHeading.current?.focus({ preventScroll: true }); }, [scopeLabel]);
  useEffect(() => {
    const nextIndex = allVocabularies.findIndex(item => item.id === activeId.current);
    if (initialized.current && nextIndex >= 0) setCurrentIndex(nextIndex);
    setReviewList(allVocabularies);
    if (!initialized.current && allVocabularies.length) {
      const progress = restoreReviewProgress(allVocabularies.map(v => v.id), initialProgress);
      setCurrentIndex(progress.index); setIsRevealed(progress.revealed); initialized.current = true;
    }
  }, [allVocabularies]);
  useEffect(() => { setCurrentIndex(index => Math.max(0, Math.min(index, Math.max(0, reviewList.length - 1)))); }, [reviewList.length]);
  const currentVocab = reviewList[currentIndex];
  useEffect(() => {
    if (currentVocab && initialized.current) writeReviewProgress({ currentId: currentVocab.id, revealed: isRevealed, completed: false, ids: reviewList.map(v => v.id) }, sessionKey);
  }, [currentVocab?.id, isRevealed, reviewList, sessionKey]);
  useEffect(() => { setSpeechError(null); }, [currentVocab?.id]);
  const refresh = async () => {
    if (refreshLock.current) return;
    refreshLock.current = true; setIsRefreshing(true); setRefreshError('');
    try { await onRefresh(); }
    catch { if (mounted.current) setRefreshError('词汇刷新失败，已有内容已保留，请重试。'); }
    finally { refreshLock.current = false; if (mounted.current) setIsRefreshing(false); }
  };
  const Heading = embedded ? 'h2' : 'h1';
  return <div className={`${embedded ? 'review-embedded' : 'page-shell page-shell--review'} page-stack review-page`}>
    <div className={embedded ? 'practice-review-heading' : 'page-stack'}><Heading ref={scopeHeading} tabIndex={scopeLabel ? -1 : undefined} className="type-page font-editorial font-semibold">词汇学习</Heading><p className="type-body text-[var(--text-secondary)]">{scopeLabel ? `${scopeLabel} · ${reviewList.length} 个词汇` : `全部已收藏词条：${reviewList.length} 项`}</p></div>
    {!currentVocab ? <div className="wordbook-empty"><BookOpen aria-hidden="true"/><h2 className="type-section">{scopeLabel ? '当前范围暂无词汇' : '还没有已收藏词条'}</h2><p>在阅读页或单词本添加表达后，即可在这里学习。</p><button type="button" disabled={isRefreshing} className="lexicon-link" onClick={() => void refresh()}>{isRefreshing ? '正在刷新…' : '刷新词汇'}</button>{refreshError && <p role="alert">{refreshError}</p>}</div> : <div className="space-y-6">
      <div className="review-progress practice-review-progress"><div className="flex items-center gap-3">
        <button type="button" aria-label="上一张词汇" disabled={detailsBusy || currentIndex === 0} onClick={() => { setCurrentIndex(index => Math.max(0, index - 1)); setIsRevealed(false); }} className="min-h-11 min-w-11"><ChevronLeft aria-hidden="true" size={22}/></button>
        <span role="status" aria-live="polite" aria-atomic="true">{currentIndex + 1} / {reviewList.length}</span>
        <button type="button" aria-label="下一张词汇" disabled={detailsBusy || currentIndex === reviewList.length - 1} onClick={() => { setCurrentIndex(index => Math.min(reviewList.length - 1, index + 1)); setIsRevealed(false); }} className="min-h-11 min-w-11"><ChevronRight aria-hidden="true" size={22}/></button>
      </div></div>
      <PracticeVocabularyCard onDetailsBusyChange={setDetailsBusy} vocab={currentVocab} meaning={getLocalizedVocabMeaning(currentVocab)} exampleTranslation={getLocalizedExampleTranslation(currentVocab)} revealed={isRevealed} disabled={false} onFlip={() => { if (!detailsBusy) setIsRevealed(value => !value); }} onPronounce={() => { setSpeechError(null); speakEnglishTerm(currentVocab.term, setSpeechError); }}/>
      {speechError && <p role="alert" className="practice-review-speech-error">{speechError}</p>}
    </div>}
  </div>;
};
