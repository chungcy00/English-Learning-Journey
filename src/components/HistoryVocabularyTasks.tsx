import React, { useRef, useState } from 'react';
import { ArrowRight, ChevronRight, Layers, Target } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { VocabularyItem } from '../types';
import { READING_LEVELS } from '../utils/readingLevelDistribution';
import { cefrStyle, cefrVisuals, formatDistributionPercent } from '../utils/cefrVisuals';
import { vocabularyTask, vocabularyLevelLabel, HISTORY_REVIEW_STATUSES, historyStatusLabel, type HistoryVocabularyLevel, type HistoryReviewMode } from '../utils/historyVocabulary';
import { HistoryLevelBadge } from './HistoryLevelBadge';
const englishNames: Record<string, string> = {A1:'Breakthrough', A2:'Elementary', B1:'Intermediate', B2:'Upper-Intermediate', C1:'Advanced', C2:'Mastery', 未知:'Uncategorized'};
function ReviewActions({ task, onReview, primaryClass, detailed = false }: {
  task: ReturnType<typeof vocabularyTask>;
  onReview: (level: HistoryVocabularyLevel | null, mode: HistoryReviewMode, status?: VocabularyItem['status']) => void;
  primaryClass: string; detailed?: boolean;
}) {
  const label = task.level ? vocabularyLevelLabel(task.level) : '';
  const [status, setStatus] = useState<VocabularyItem['status']>(() => HISTORY_REVIEW_STATUSES.find(item => task.statusCounts[item.value] > 0)?.value || 'New');
  const count = task.statusCounts[status];
  return <div className={`history-task-actions${detailed ? ' history-task-actions--detail' : ''}`}>
    <button type="button" className={primaryClass} disabled={!task.total}
      aria-label={`复习全部${label}词汇（${task.total}词）`}
      onClick={() => onReview(task.level, 'free')}>复习全部（{task.total}词）<ArrowRight size={17} aria-hidden="true" /></button>
    <div className="history-status-review">
      <label><span>学习状态</span><select aria-label={`${label || '全部'}词汇学习状态`} value={status} onChange={event => setStatus(event.target.value as VocabularyItem['status'])}>
        {HISTORY_REVIEW_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}（{task.statusCounts[item.value]}词）</option>)}
      </select></label>
      <button type="button" disabled={!count} className="history-task-status"
        aria-label={`${label || '全部'}分类复习：${historyStatusLabel(status)}（${count}词）`}
        onClick={() => onReview(task.level, 'status', status)}>复习所选（{count}词）</button>
    </div>
  </div>;
}
function Mastery({task, detailed = false}: {task: ReturnType<typeof vocabularyTask>; detailed?: boolean}) {
  return <div className={`history-mastery${detailed?' is-detailed':''}`}><div><span>掌握进度</span><strong>{task.mastered}/{task.total} 词（{formatDistributionPercent(task.percentage)}）</strong></div><div role="progressbar" aria-label={`${task.level ? vocabularyLevelLabel(task.level) : '全部词汇'}掌握进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.percentage} aria-valuetext={`${task.mastered}/${task.total} 词，${formatDistributionPercent(task.percentage)}`}><span style={{transform:`scaleX(${task.percentage/100})`}}/></div></div>;
}
export function HistoryVocabularyTasks({vocabulary, selectedLevel, onSelectLevel, onReview, onOpenWordbook}: {
  vocabulary: VocabularyItem[]; selectedLevel: HistoryVocabularyLevel | null;
  onSelectLevel: (level: HistoryVocabularyLevel) => void;
  onReview: (level: HistoryVocabularyLevel | null, mode: HistoryReviewMode, status?: VocabularyItem['status']) => void;
  onOpenWordbook: (level: HistoryVocabularyLevel) => void;
}) {
  const reduced = useReducedMotion();
  const focusDetail = useRef(false);
  const selected = vocabularyTask(vocabulary, selectedLevel);
  const all = vocabularyTask(vocabulary, null);
  const label = selectedLevel ? vocabularyLevelLabel(selectedLevel) : '';
  return <section className="history-vocabulary-tasks" aria-label="词汇复习任务">
    <AnimatePresence mode="wait" initial={false}><motion.div key={selectedLevel || 'all'} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:.18}}>
      {selectedLevel ? <div className="history-vocabulary-detail" style={cefrStyle(selectedLevel)}>
        <header><span className="history-task-icon"><Target size={24} aria-hidden="true"/></span><div><h2 tabIndex={-1} ref={node => { if (node && focusDetail.current) { focusDetail.current = false; node.focus({ preventScroll: true }); } }}>{selectedLevel==='未知'?'未标注等级词汇复习':`${label} ${cefrVisuals[selectedLevel].name}词汇复习`}</h2><p>已收录 {selected.total} 词 · <strong>已掌握 {selected.mastered} 词</strong></p></div></header>
        <Mastery task={selected} detailed/>
        <div className="history-recent-heading"><h3>最近添加</h3><button type="button" aria-label={`查看全部${label}词汇`} onClick={()=>onOpenWordbook(selectedLevel)}>查看全部<ChevronRight size={18} aria-hidden="true"/></button></div>
        <div className="history-recent-words">{selected.recent.map(word=><span key={word.id}>{word.term}</span>)}</div>
        <ReviewActions task={selected} onReview={onReview} primaryClass="history-task-primary" detailed />
      </div> : <>
        <h2 className="history-task-title">词汇复习任务</h2>
        <div className="history-review-all"><Layers size={23} aria-hidden="true"/><div><h3>全部词汇综合复习</h3><p>{all.total} 词收录 · <strong>已掌握 {all.mastered} 词</strong></p></div><ReviewActions task={all} onReview={onReview} primaryClass="history-task-start-all" /></div>
        <div className="history-specialized-heading"><h3>分级专项复习</h3><span>按 CEFR 等级</span></div>
        <div className="history-task-list">{READING_LEVELS.map(level=>vocabularyTask(vocabulary,level)).filter(task=>task.total>0).map(task=><article className="history-task-card" key={task.level} style={cefrStyle(task.level!)}>
          <div className="history-task-row"><button type="button" className="history-task-info" aria-label={`查看${vocabularyLevelLabel(task.level!)}复习看板`} onClick={()=>{focusDetail.current=true;onSelectLevel(task.level!);}}><HistoryLevelBadge level={vocabularyLevelLabel(task.level!)}/><span><strong>{task.level==='未知'?'未标注等级':cefrVisuals[task.level!].name}</strong><small>{englishNames[task.level!]}</small></span></button><ReviewActions task={task} onReview={onReview} primaryClass="history-task-start" /></div>
          <p>{task.total} 词收录</p><Mastery task={task}/>
        </article>)}</div>
        {!all.total&&<p className="history-empty" role="status">暂无已收录词汇，可在阅读页或生词本添加。</p>}
      </>}
    </motion.div></AnimatePresence>
  </section>;
}
