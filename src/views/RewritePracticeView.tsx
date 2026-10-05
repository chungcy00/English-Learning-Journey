import React, { useSyncExternalStore } from 'react';
import { ArrowLeft, FilePenLine, ChartNoAxesColumnIncreasing, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { ReadingRecord } from '../types';
import { RewritePracticeCard } from '../components/RewritePracticeCard';
import { rewriteProgressKey, rewriteProgressStore } from '../utils/rewriteProgress';

export function RewritePracticeView({ reading, targetLanguage, onBack }: { reading: ReadingRecord | null; targetLanguage: string; onBack: () => void }) {
  const exercises = reading?.rewritePractice || [];
  const snapshot = useSyncExternalStore(rewriteProgressStore.subscribe,
    () => JSON.stringify(exercises.map(item => {
      const entry = rewriteProgressStore.get(rewriteProgressKey(reading!.id, item), item);
      return entry.pending ? 'pending' : entry.evaluation ? 'evaluated' : entry.answer.trim() ? 'draft' : 'empty';
    })), () => '[]');
  const statuses: string[] = JSON.parse(snapshot);
  const completed = statuses.filter(status => status === 'evaluated').length;
  const percent = exercises.length ? Math.round(completed / exercises.length * 100) : 0;
  return <div className="page-shell page-stack rewrite-page">
    <button type="button" onClick={onBack} className="practice-back"><ArrowLeft aria-hidden="true" className="w-4 h-4" />练习与生词</button>
    <header className="practice-detail-heading">
      <div><h1 className="type-page font-editorial font-semibold">Rewrite the Sentence</h1>
        <p className="type-body font-ui text-[#555848] mt-2">使用指定词汇，用自己的方式重新表达原句。</p></div>
    </header>
    {reading && exercises.length ? <div className="rewrite-workspace">
      <section className="rewrite-question-panel" aria-labelledby="rewrite-questions-title">
        <header className="rewrite-panel-heading"><FilePenLine aria-hidden="true" />
          <h2 id="rewrite-questions-title" className="font-editorial">改写练习</h2>
          <span className="rewrite-count font-ui">共 {exercises.length} 题</span>
        </header>
        <div className="rewrite-practice-section">
      {exercises.map((item, index) => <RewritePracticeCard key={`${reading.id}:${item.id}:${item.originalSentence}:${item.target}:${item.referenceAnswer}`}
        readingId={reading.id} item={item} index={index} cefrLevel={reading.cefrLevel}
        targetLanguage={targetLanguage} currentTranslation={reading.translations?.[targetLanguage]} />)}
        </div>
      </section>
      <aside className="rewrite-progress-panel" aria-labelledby="rewrite-progress-title">
        <header className="rewrite-panel-heading"><ChartNoAxesColumnIncreasing aria-hidden="true" />
          <h2 id="rewrite-progress-title" className="font-ui">学习进度</h2>
        </header>
        <div className="rewrite-progress-summary font-ui"><span>已评估 {completed} / {exercises.length} 题</span><span>{percent}%</span></div>
        <progress className="rewrite-progress-track" value={completed} max={exercises.length} aria-label="已评估题目进度" />
        <ol className="rewrite-progress-list font-ui">
          {exercises.map((item, index) => <li key={item.id}>
            <a href={`#rewrite-exercise-${item.id}`} className="rewrite-progress-link">
              {statuses[index] === 'evaluated' ? <CheckCircle2 aria-hidden="true" /> : statuses[index] === 'pending' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Circle aria-hidden="true" />}
              <span><span className="rewrite-progress-target">{index + 1}. {item.target}</span><span className="rewrite-progress-state">{statuses[index] === 'evaluated' ? '已评估' : statuses[index] === 'pending' ? '评估中' : statuses[index] === 'draft' ? '草稿' : '未作答'}</span></span>
            </a>
          </li>)}
        </ol>
      </aside>
    </div> : <p className="practice-empty type-body font-ui">{reading ? '这篇短文暂无改写练习，可选择其他短文。' : '请先生成或打开一篇短文。'}</p>}
  </div>;
}
