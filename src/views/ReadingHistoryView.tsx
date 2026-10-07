import React from 'react';
import { ArrowRight, History, Trash2 } from 'lucide-react';
import { ReadingRecord } from '../types';
import { ReadingLevelPieChart } from '../components/ReadingLevelPieChart';
import { filterReadingsByLevel, type DistributionDimension } from '../utils/readingLevelDistribution';

interface ReadingHistoryViewProps {
  readings: ReadingRecord[];
  onSelectReading: (reading: ReadingRecord) => void;
  onDeleteReading: (readingId: string) => void;
  onCreateReading?: () => void;
}

const types = { story: '故事', dialogue: '对话', 'non-story': '说明', random: '随机' };
const lengths = { short: '短 · 80–120 词', medium: '中 · 150–200 词', long: '长 · 250–350 词' };

function ReadingDate({ value }: { value: number }) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return <span>日期未知</span>;
  return <time dateTime={date.toISOString()}>{date.toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>;
}

export const ReadingHistoryView: React.FC<ReadingHistoryViewProps> = ({
  readings, onSelectReading, onDeleteReading, onCreateReading,
}) => {
  const [dimension, setDimension] = React.useState<DistributionDimension>('readings');
  const [selectedLevel, setSelectedLevel] = React.useState<string | null>(null);
  const visibleReadings = filterReadingsByLevel<ReadingRecord>(readings, selectedLevel, dimension);
  return (
  <div className="page-shell history-page">
    <header>
      <h1 className="type-page font-editorial font-semibold">阅读历史记录</h1>
      <p className="type-body mt-2 text-[var(--text-secondary)]">共保存 {readings.length} 篇学习短文</p>
    </header>
    <ReadingLevelPieChart readings={readings} dimension={dimension} selectedLevel={selectedLevel}
      onDimensionChange={value => { setDimension(value); setSelectedLevel(null); }}
      onLevelSelect={value => setSelectedLevel(current => current === value ? null : value)} />
    {selectedLevel && <div className="history-filter-summary" role="status">{selectedLevel} · 显示 {visibleReadings.length} / {readings.length} 篇短文 <button type="button" onClick={() => setSelectedLevel(null)}>清除筛选</button></div>}
    <div className="history-list">
      {readings.length === 0 ? (
        <div className="history-empty">
          <History aria-hidden="true" size={28} />
          <p className="type-body">还没有保存的短文记录</p>
          {onCreateReading && <button className="history-continue" type="button" onClick={onCreateReading}>生成第一篇短文<ArrowRight size={18} aria-hidden="true" /></button>}
        </div>
      ) : visibleReadings.length === 0 ? <div className="history-empty"><p>没有符合该等级的短文。</p><button type="button" className="history-continue" onClick={() => setSelectedLevel(null)}>查看全部短文</button></div> : visibleReadings.map(item => (
        <article key={item.id} className="history-entry">
          <div className="history-entry__heading">
            <h2 className="font-editorial font-semibold">{item.title}</h2>
            <button className="history-delete" type="button" title="删除" aria-label={`删除 ${item.title}`}
              onClick={() => { if (window.confirm(`确定删除短文 “${item.title}” 吗？`)) onDeleteReading(item.id); }}>
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="history-badges">
            <span className="history-level">{item.cefrLevel || '未知'}</span>
            <span>{types[item.readingType] || '未知文体'}</span>
            <span>{lengths[item.length] || '未知篇幅'}</span>
          </div>
          <div className="history-entry__footer">
            <ReadingDate value={item.createdAt} />
            <button className="history-continue" type="button" aria-label={`继续阅读：${item.title}`} onClick={() => onSelectReading(item)}>继续阅读<ArrowRight size={18} aria-hidden="true" /></button>
          </div>
        </article>
      ))}
    </div>
  </div>
  );
};
