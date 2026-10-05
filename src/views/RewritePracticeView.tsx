import React, { useSyncExternalStore } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ReadingRecord } from '../types';
import { RewritePracticeCard } from '../components/RewritePracticeCard';
import { rewriteProgressKey, rewriteProgressStore } from '../utils/rewriteProgress';

export function RewritePracticeView({ reading, targetLanguage, onBack }: { reading: ReadingRecord | null; targetLanguage: string; onBack: () => void }) {
  const exercises = reading?.rewritePractice || [];
  const completed = useSyncExternalStore(rewriteProgressStore.subscribe,
    () => reading ? exercises.filter(item => rewriteProgressStore.get(rewriteProgressKey(reading.id, item), item).evaluation).length : 0,
    () => 0);
  return <div className="page-shell page-stack rewrite-page">
    <button type="button" onClick={onBack} className="practice-back"><ArrowLeft aria-hidden="true" className="w-4 h-4" />练习与生词</button>
    <header className="practice-detail-heading">
      <div><h1 className="type-page font-editorial font-semibold">Rewrite the Sentence</h1>
        <p className="type-body font-ui text-[#555848] mt-2">使用指定词汇，用自己的方式重新表达原句。</p></div>
      {exercises.length > 0 && <p className="type-label font-ui text-[#555848]">已评估 {completed} / {exercises.length} 题</p>}
    </header>
    {reading && exercises.length ? <div className="rewrite-practice-section space-y-4">
      {exercises.map((item, index) => <RewritePracticeCard key={`${reading.id}:${item.id}:${item.originalSentence}:${item.target}:${item.referenceAnswer}`}
        readingId={reading.id} item={item} index={index} cefrLevel={reading.cefrLevel}
        targetLanguage={targetLanguage} currentTranslation={reading.translations?.[targetLanguage]} />)}
    </div> : <p className="practice-empty type-body font-ui">{reading ? '这篇短文暂无改写练习，可选择其他短文。' : '请先生成或打开一篇短文。'}</p>}
  </div>;
}
