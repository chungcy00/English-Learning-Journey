import React, { useRef } from 'react';
import { ArrowRight, ChevronRight, History, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ReadingRecord, VocabularyItem } from '../types';
import { ReadingLevelPieChart } from '../components/ReadingLevelPieChart';
import { HistoryLevelBadge } from '../components/HistoryLevelBadge';
import { HistoryDeletionDialog } from '../components/HistoryDeletionDialog';
import { HistoryVocabularyTasks } from '../components/HistoryVocabularyTasks';
import { vocabularyLevel, type HistoryVocabularyLevel } from '../utils/historyVocabulary';
import { distributionSource, filterReadingsByLevel, type DistributionDimension } from '../utils/readingLevelDistribution';

interface ReadingHistoryViewProps {
  readings: ReadingRecord[];
  onSelectReading: (reading: ReadingRecord) => void;
  onDeleteReading: (readingId: string) => Promise<void>;
  onCreateReading?: () => void;
  vocabulary?: VocabularyItem[];
  onReviewVocabulary?: (level: HistoryVocabularyLevel | null) => void;
  onOpenLevelWordbook?: (level: HistoryVocabularyLevel) => void;
  active?: boolean;
}
const types = { story: '故事', dialogue: '对话', 'non-story': '说明', random: '随机' };
const lengths = { short: '短 · 80–120 词', medium: '中 · 150–200 词', long: '长 · 250–350 词' };
function ReadingDate({ value }: { value: number }) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return <span>日期未知</span>;
  return <time dateTime={date.toISOString()}>{date.toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>;
}
export const ReadingHistoryView: React.FC<ReadingHistoryViewProps> = ({ readings, onSelectReading, onDeleteReading, onCreateReading, vocabulary = [], onReviewVocabulary, onOpenLevelWordbook, active = true }) => {
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => {
    if (!active) return;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, [active]);
  const [dimension, setDimension] = React.useState<DistributionDimension>('readings');
  const [selectedLevel, setSelectedLevel] = React.useState<string | null>(null);
  const [managing, setManaging] = React.useState(false);
  const [deletion, setDeletion] = React.useState<ReadingRecord | null>(null);
  const manager = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  // If deletion removes the last record of the selected level, reset the filter.
  const activeLevel = selectedLevel && (dimension === 'vocabulary' ? vocabulary.some(item => vocabularyLevel(item) === selectedLevel) : distributionSource(readings, dimension).some(item => item.cefrLevel === selectedLevel)) ? selectedLevel : null;
  React.useEffect(() => { if (selectedLevel && !activeLevel) setSelectedLevel(null); }, [activeLevel, selectedLevel]);
  const visibleReadings = filterReadingsByLevel<ReadingRecord>(readings, activeLevel, dimension).sort((a, b) => b.createdAt - a.createdAt);
  const transition = { duration: reducedMotion ? 0 : .2, ease: 'easeOut' as const };
  const confirmDeletion = async () => {
    if (!deletion) return;
    await onDeleteReading(deletion.id);
    setDeletion(null);
    requestAnimationFrame(() => manager.current?.focus({ preventScroll: true }));
  };
  return <div className="page-shell history-page history-final">
    <header><h1 className="type-page font-ui font-semibold">阅读历史记录</h1><p className="history-total">共保存了 {readings.length} 篇学习短文</p></header>
    <ReadingLevelPieChart readings={readings} dimension={dimension} selectedLevel={activeLevel} vocabulary={vocabulary}
      onDimensionChange={value => { setDimension(value); setSelectedLevel(null); }}
      onLevelSelect={value => setSelectedLevel(current => current === value ? null : value)} />
    {dimension === 'vocabulary' ? <HistoryVocabularyTasks vocabulary={vocabulary} selectedLevel={activeLevel as HistoryVocabularyLevel | null} now={now} onSelectLevel={value => setSelectedLevel(current => current === value ? null : value)} onReview={level => onReviewVocabulary?.(level)} onOpenWordbook={level => onOpenLevelWordbook?.(level)}/> : <section className="history-records" aria-labelledby="history-list-title">
      <div className="history-list-heading"><h2 id="history-list-title">历史短文 {activeLevel && <HistoryLevelBadge level={activeLevel}/>}</h2><button ref={manager} type="button" disabled={!readings.length && !managing} aria-pressed={managing} onClick={() => setManaging(value => !value)}>{managing ? '完成' : '管理'}</button></div>
      <p className="history-list-description">{activeLevel ? dimension === 'vocabulary' ? `含 ${activeLevel} 精选词汇的历史短文` : '已筛选的历史短文' : '按最近生成时间排列'}</p>
      <div className="history-list" aria-label="历史短文列表">
        <AnimatePresence initial={false}>
          {visibleReadings.map(item => <motion.article layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0, margin: 0, paddingBlock: 0 }} transition={transition} key={item.id} className={`history-entry history-card${managing ? ' is-managing' : ''}`}>
            {!managing && <button className="history-card-open" type="button" aria-label={`阅读：${item.title}`} onClick={() => onSelectReading(item)} />}
            <div className="history-entry__heading"><h3>{item.title}</h3><span className="history-read-arrow" aria-hidden="true"><ChevronRight size={20}/></span></div>
            <div className="history-card-metadata" aria-hidden={managing} inert={managing}><div><div className="history-badges"><HistoryLevelBadge level={item.cefrLevel || '未知'}/><span>{types[item.readingType] || '未知文体'}</span><span>{lengths[item.length] || '未知篇幅'}</span></div></div></div>
            <div className="history-entry__footer"><ReadingDate value={item.createdAt}/><span className="history-read-label" aria-hidden={managing}>阅读</span></div>
            <div className="history-delete-action" aria-hidden={!managing} inert={!managing}><button type="button" aria-label={`删除 ${item.title}`} onClick={() => setDeletion(item)}><Trash2 size={18} aria-hidden="true"/>删除</button></div>
          </motion.article>)}
        </AnimatePresence>
        {visibleReadings.length === 0 && <div className="history-empty" role="status"><History aria-hidden="true" size={28}/><p>{readings.length ? '没有符合筛选的短文。' : '还没有保存的短文记录'}</p>{activeLevel ? <button type="button" onClick={() => setSelectedLevel(null)}>清除筛选</button> : onCreateReading && <button type="button" onClick={onCreateReading}>生成第一篇短文<ArrowRight size={18} aria-hidden="true"/></button>}</div>}
      </div>
    </section>}
    {deletion && <HistoryDeletionDialog title={deletion.title} onCancel={() => setDeletion(null)} onConfirm={confirmDeletion}/>}
  </div>;
};
