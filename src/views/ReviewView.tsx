import { HandOutline } from '../components/LearningArt';
import React, { useState, useEffect, useRef } from 'react';
import { readReviewProgress, restoreReviewProgress, writeReviewProgress } from '../utils/reviewProgress';
import { BookOpen, ChevronLeft, ChevronRight, Shuffle, RefreshCw, Minus, Plus } from 'lucide-react';
import type { VocabularyItem } from '../types';
import { getLocalizedVocabMeaning, getLocalizedExampleTranslation } from '../utils/i18n';
import { speakEnglishTerm } from '../utils/speech';
import { PracticeVocabularyCard } from '../components/PracticeVocabularyCard';
import {ReviewCategorySelect} from '../components/ReviewCategorySelect';
import {availableReviewCategories,reviewWordsForCategory,type ReviewCategory} from '../utils/reviewCategories';
import {readRandomReview, writeRandomReview, sampleReviewIds, reconcileReviewIds} from '../utils/randomReview';

interface ReviewViewProps {
  key?: string | number;
  embedded?: boolean;
  sessionKey?: string;
  scopeLabel?: string;
  allVocabularies: VocabularyItem[];
  onRefresh: () => void | Promise<void>;
}

export function ReviewView(props:ReviewViewProps) {
  const storageKey=`mine-review-category:${props.sessionKey||'all'}`;
  const [category,setCategory]=useState<ReviewCategory>(()=>{try{return (sessionStorage.getItem(storageKey)||'all') as ReviewCategory;}catch{return 'all';}});
  const categories=availableReviewCategories(props.allVocabularies);
  const effective=categories.includes(category as any)?category:'all';
  const change=(value:ReviewCategory)=>{setCategory(value);try{sessionStorage.setItem(storageKey,value);}catch{}requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('.random-review__category [role="combobox"]')?.focus({preventScroll:true}));};
  return <RandomReviewView {...props} key={`${props.sessionKey||'all'}:${effective}`} allVocabularies={reviewWordsForCategory(props.allVocabularies,effective)} collectionCount={props.allVocabularies.length} categories={categories} category={effective} onCategoryChange={change} sessionKey={effective==='all'?props.sessionKey:`${props.sessionKey||'all'}:category:${effective}`}/>;
}

/** Browse saved learning content without grading or changing the old review schedule. */
const RandomReviewView: React.FC<ReviewViewProps & {key?:string;collectionCount:number;categories:Exclude<ReviewCategory,'all'>[];category:ReviewCategory;onCategoryChange:(value:ReviewCategory)=>void}> = ({ allVocabularies, onRefresh, embedded = false, sessionKey, scopeLabel,collectionCount,categories,category,onCategoryChange }) => {
  const [initialProgress] = useState(() => readReviewProgress(sessionKey));
  const [selection, setSelection] = useState(() => { const saved = readRandomReview(sessionKey); const count = saved ? saved.count : 20; return {count, ids: saved ? (allVocabularies.length ? reconcileReviewIds(saved.ids, allVocabularies.map(v=>v.id), count) : saved.ids) : sampleReviewIds(allVocabularies.map(v=>v.id), count)}; });
  const [customCount, setCustomCount] = useState(String(Math.min(selection.count || allVocabularies.length, allVocabularies.length) || 1));
  const restored = restoreReviewProgress(selection.ids, initialProgress);
  const [currentIndex, setCurrentIndex] = useState(restored.index);
  const [isRevealed, setIsRevealed] = useState(restored.revealed);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const wordById = new Map(allVocabularies.map(word=>[word.id,word]));
  const reviewList = selection.ids.map(id=>wordById.get(id)).filter((word): word is VocabularyItem=>!!word);
  const activeId = useRef(reviewList[currentIndex]?.id);
  activeId.current = reviewList[currentIndex]?.id;
  const initialized = useRef(allVocabularies.length > 0);
  const refreshLock = useRef(false);
  const mounted = useRef(true);
  const scopeHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (scopeLabel) scopeHeading.current?.focus({ preventScroll: true }); }, [scopeLabel]);
  useEffect(() => {
    if (!initialized.current && !allVocabularies.length) return;
    const ids = reconcileReviewIds(selection.ids, allVocabularies.map(word=>word.id), selection.count);
    if(!initialized.current && initialProgress && allVocabularies.some(word=>word.id===initialProgress.currentId) && !ids.includes(initialProgress.currentId)) ids[0]=initialProgress.currentId;
    const nextIndex = ids.indexOf(activeId.current || '');
    if (initialized.current && nextIndex >= 0) setCurrentIndex(nextIndex);
    if (ids.join('\0') !== selection.ids.join('\0')) setSelection(value=>({...value,ids}));
    if (!initialized.current && allVocabularies.length) {
      const progress = restoreReviewProgress(ids, initialProgress);
      setCurrentIndex(progress.index); setIsRevealed(progress.revealed); setCustomCount(String(ids.length || 1)); initialized.current = true;
    }
  }, [allVocabularies, selection.ids, selection.count]);
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
  useEffect(() => { if(selection.ids.length) writeRandomReview(selection,sessionKey); },[selection,sessionKey]);
  const choose = (count: number | null) => {
    if(detailsBusy || !allVocabularies.length)return;
    let ids = sampleReviewIds(allVocabularies.map(word=>word.id),count);
    if(ids.length===1 && ids[0]===selection.ids[0] && allVocabularies.length>1) ids=[allVocabularies.find(word=>word.id!==ids[0])!.id];
    if(ids.length>1 && ids.every((id,index)=>id===selection.ids[index])) ids=[...ids.slice(1),ids[0]];
    setSelection({count,ids});setCustomCount(String(ids.length));setCurrentIndex(0);setIsRevealed(false);
  };
  const move = (step:number) => { if(!detailsBusy){setCurrentIndex(index=>Math.min(reviewList.length-1,Math.max(0,index+step)));setIsRevealed(false);} };
  const Heading = embedded ? 'h2' : 'h1';
  return <div className={`${embedded ? 'review-embedded' : 'page-shell page-shell--review'} page-stack review-page type-body`} onKeyDown={event=>{if(!event.defaultPrevented && !detailsBusy && !(event.target as Element).closest('button,input,textarea,select,a,[role="tab"]') && ['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}}}>
    <section className="random-review" aria-label="随机复习"><HandOutline/>
      <div className="random-review__controls"><Heading ref={scopeHeading} tabIndex={scopeLabel ? -1 : undefined} className="type-section font-semibold"><Shuffle size={18} aria-hidden="true"/>随机复习</Heading>
        <ReviewCategorySelect value={category} categories={categories} disabled={detailsBusy||!collectionCount} onChange={onCategoryChange}/>
        <div className="random-review__presets" role="group" aria-label="随机复习数量">{[10,20,50].map(count=><button type="button" key={count} aria-pressed={selection.count===count} disabled={detailsBusy||!allVocabularies.length} onClick={()=>choose(count)}>{count} 词</button>)}<button type="button" aria-pressed={selection.count===null} disabled={detailsBusy||!allVocabularies.length} onClick={()=>choose(null)}>全部 {allVocabularies.length} 词</button></div>
        <form className="random-review__custom" onSubmit={event=>{event.preventDefault();choose(Math.min(allVocabularies.length,Math.max(1,Number(customCount)||1)));}}><button type="button" aria-label="减少随机复习数量" disabled={detailsBusy||!allVocabularies.length||Number(customCount)<=1} onClick={()=>setCustomCount(String(Math.max(1,(Number(customCount)||1)-1)))}><Minus size={14}/></button><input type="number" inputMode="numeric" aria-label="自定义随机复习数量" min={1} max={Math.max(1,allVocabularies.length)} value={customCount} disabled={detailsBusy||!allVocabularies.length} onChange={event=>setCustomCount(event.target.value)}/><span>词</span><button type="button" aria-label="增加随机复习数量" disabled={detailsBusy||!allVocabularies.length||Number(customCount)>=allVocabularies.length} onClick={()=>setCustomCount(String(Math.min(allVocabularies.length,(Number(customCount)||0)+1)))}><Plus size={14}/></button><button type="submit" disabled={detailsBusy||!allVocabularies.length||!customCount}>应用</button></form>
        <button className="random-review__reshuffle" type="button" disabled={detailsBusy||!allVocabularies.length} onClick={()=>choose(selection.count)}><RefreshCw size={15}/>换一组</button>
      </div>
      <div className="random-review__status">{!!reviewList.length && <div className="review-progress practice-review-progress"><div className="flex items-center gap-3"><button type="button" aria-label="上一张词汇" disabled={detailsBusy||currentIndex===0||!reviewList.length} onClick={()=>move(-1)}><ChevronLeft size={18}/></button><span role="status" aria-live="polite" aria-atomic="true">{reviewList.length ? currentIndex+1 : 0} / {reviewList.length}</span><button type="button" aria-label="下一张词汇" disabled={detailsBusy||currentIndex>=reviewList.length-1} onClick={()=>move(1)}><ChevronRight size={18}/></button></div></div>}</div>
    </section>
    {!currentVocab ? <div className="wordbook-empty"><BookOpen aria-hidden="true"/><h2 className="type-section">{scopeLabel ? '当前范围暂无词汇' : '还没有已收藏词条'}</h2><p>在阅读页或单词本添加表达后，即可在这里学习。</p><button type="button" disabled={isRefreshing} className="lexicon-link" onClick={() => void refresh()}>{isRefreshing ? '正在刷新…' : '刷新词汇'}</button>{refreshError && <p role="alert">{refreshError}</p>}</div> : <div className="space-y-6">
      <PracticeVocabularyCard onDetailsBusyChange={setDetailsBusy} vocab={currentVocab} meaning={getLocalizedVocabMeaning(currentVocab)} exampleTranslation={getLocalizedExampleTranslation(currentVocab)} revealed={isRevealed} disabled={false} onFlip={() => { if (!detailsBusy) setIsRevealed(value => !value); }} onPronounce={() => { setSpeechError(null); speakEnglishTerm(currentVocab.term, setSpeechError); }}/>
      {speechError && <p role="alert" className="practice-review-speech-error">{speechError}</p>}
    </div>}
  </div>;
};
