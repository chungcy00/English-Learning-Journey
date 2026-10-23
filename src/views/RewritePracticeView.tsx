import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChartNoAxesColumnIncreasing, Check, Loader2 } from 'lucide-react';
import type { ReadingRecord } from '../types';
import { RewritePracticeCard } from '../components/RewritePracticeCard';
import { rewriteProgressKey, rewriteProgressStore } from '../utils/rewriteProgress';
import { uniqueRewriteQuestions, rewriteNextAction, readRewriteSelection, writeRewriteSelection } from '../utils/rewriteQuestions';

export function RewritePracticeView({ reading, onBack }: { reading: ReadingRecord | null; onBack: () => void }) {
  const exercises = useMemo(() => uniqueRewriteQuestions(reading?.id ?? '', reading?.rewritePractice ?? []), [reading?.id, reading?.rewritePractice]);
  const [selectedKey, setSelectedKey] = useState<string>(() => readRewriteSelection(reading?.id ?? '') ?? '');
  useEffect(() => { setSelectedKey(readRewriteSelection(reading?.id ?? '') ?? ''); }, [reading?.id]);
  const index = Math.max(0, exercises.findIndex(item => rewriteProgressKey(reading!.id, item) === selectedKey));
  const current = exercises[index];
  const question = useRef<HTMLElement>(null);
  const revealQuestion = useRef(false);
  useEffect(() => {
    if (!revealQuestion.current) return;
    revealQuestion.current = false;
    // Wait for layout/scroll anchoring after the long report is removed.
    // This runs once per explicit question change, never while typing.
    const frame = requestAnimationFrame(() => {
      question.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [current]);
  const snapshot = useSyncExternalStore(rewriteProgressStore.subscribe,
    () => JSON.stringify(exercises.map(item => {
      const entry = rewriteProgressStore.get(rewriteProgressKey(reading!.id, item), item);
      return entry.evaluation ? 'evaluated' : entry.pending ? 'pending' : 'incomplete';
    })), () => JSON.stringify(exercises.map(item => item.evaluation ? 'evaluated' : 'incomplete')));
  const statuses: string[] = JSON.parse(snapshot);
  const completed = statuses.filter(status => status === 'evaluated').length;
  const select = (next: number) => {
    const key = rewriteProgressKey(reading!.id, exercises[next]);
    revealQuestion.current = key !== rewriteProgressKey(reading!.id, current);
    writeRewriteSelection(reading!.id, key); setSelectedKey(key);
  };
  const next = rewriteNextAction(index, statuses.map(status => status === 'evaluated'));
  return <div className="page-shell page-stack rewrite-page">
    <button type="button" onClick={onBack} className="practice-back"><ChevronLeft aria-hidden="true" size={18} />练习与生词</button>
    <header className="practice-detail-heading">
      <h1 className="type-page font-ui font-semibold">句子改写</h1>
      <p className="type-body font-ui text-[var(--text-secondary)]">使用指定词汇，用自己的方式重新表达原句。</p>
    </header>
    {reading && current ? <div className="rewrite-workspace">
      <aside className="rewrite-progress-panel" aria-labelledby="rewrite-progress-title">
        <header className="rewrite-panel-heading"><ChartNoAxesColumnIncreasing aria-hidden="true" />
          <h2 id="rewrite-progress-title">学习进度</h2>
          <span className="rewrite-progress-summary" role="status">{completed} / {exercises.length} 已评估</span>
        </header>
        <progress className="rewrite-progress-track" value={completed} max={exercises.length} aria-label="已评估题目进度" />
        <ol className="rewrite-progress-list">
          {exercises.map((item, step) => {
            const evaluated = statuses[step] === 'evaluated';
            const active = step === index;
            const status = evaluated ? '已评估' : statuses[step] === 'pending' ? '评估中' : active ? '当前' : '待完成';
            return <li key={rewriteProgressKey(reading.id, item)}>
              <button type="button" className={`rewrite-progress-step${evaluated ? ' is-evaluated' : ''}${active ? ' is-current' : ''}`}
                aria-label={`第 ${step + 1} 题，${status}${active && evaluated ? '，当前' : ''}`} aria-current={active ? 'step' : undefined}
                onClick={() => select(step)}>
                <span className="rewrite-progress-number">{evaluated ? <Check aria-hidden="true" size={20} /> : statuses[step] === 'pending' ? <Loader2 aria-hidden="true" className="animate-spin" size={20} /> : step + 1}</span>
                <span className="rewrite-progress-state">{status}</span>
              </button>
            </li>;
          })}
        </ol>
      </aside>
      <section ref={question} className="rewrite-question-panel" aria-label="当前改写题目">
        <RewritePracticeCard key={rewriteProgressKey(reading.id, current)} readingId={reading.id} item={current} index={index}
          nextLabel={next.label} onNext={() => next.index === null ? onBack() : select(next.index)}
          total={exercises.length} onPrevious={index > 0 ? () => select(index - 1) : undefined}
          cefrLevel={reading.cefrLevel} currentTranslation={reading.translations?.['zh-CN']} />
      </section>
    </div> : <p className="practice-empty type-body font-ui">{reading ? '这篇短文暂无改写练习，可选择其他短文。' : '请先生成或打开一篇短文。'}</p>}
  </div>;
}
