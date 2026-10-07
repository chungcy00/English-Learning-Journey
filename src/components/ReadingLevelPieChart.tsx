import React, { useState } from 'react';
import { BookOpen, ChartNoAxesColumn, ChartPie, Sparkles } from 'lucide-react';
import { distributionSource, readingLevelDistribution, type DistributionDimension, type DistributionReading } from '../utils/readingLevelDistribution';
import { activeDistributionLevel, donutSegmentPath } from '../utils/donutInteraction';

const levels: Record<string, { name: string; color: string }> = {
  A1: { name: 'Breakthrough', color: '#A5BBA2' }, A2: { name: 'Elementary', color: '#EBC78C' },
  B1: { name: 'Intermediate', color: '#8FA38C' }, B2: { name: 'Upper-Intermediate', color: '#DDA99C' },
  C1: { name: 'Advanced', color: '#9CB0BA' }, C2: { name: 'Mastery', color: '#C8BAAD' },
  未知: { name: 'Unclassified', color: '#E3E0D7' },
};

export function ReadingLevelPieChart({ readings, dimension: controlledDimension, selectedLevel = null, onDimensionChange, onLevelSelect }: {
  readings: readonly DistributionReading[];
  dimension?: DistributionDimension;
  selectedLevel?: string | null;
  onDimensionChange?: (dimension: DistributionDimension) => void;
  onLevelSelect?: (level: string) => void;
}) {
  const [localDimension, setLocalDimension] = useState<DistributionDimension>('readings');
  const [hoveredLevel, setHoveredLevel] = useState<string | null>(null);
  const [focusedLevel, setFocusedLevel] = useState<string | null>(null);
  const dimension = controlledDimension || localDimension;
  const source = distributionSource(readings, dimension);
  const distribution = readingLevelDistribution(source);
  const dominant = [...distribution].sort((a, b) => b.count - a.count)[0];
  const activeLevel = activeDistributionLevel(hoveredLevel || focusedLevel, selectedLevel, dominant.level);
  const active = distribution.find(item => item.level === activeLevel)!;
  const interaction = (level: string) => ({
    onPointerEnter: (event: React.PointerEvent) => { if (event.pointerType !== 'touch') setHoveredLevel(level); },
    onPointerLeave: () => setHoveredLevel(null),
    onFocus: (event: React.FocusEvent<Element>) => { if (event.currentTarget.matches(':focus-visible')) setFocusedLevel(level); },
    onBlur: () => setFocusedLevel(null),
  });
  const unknown = distribution.find(item => item.level === '未知')!;
  const totalWords = distributionSource(readings, 'vocabulary').length;
  const unit = dimension === 'readings' ? '篇' : '条';
  let offset = 0;
  const percent = (value: number) => `${value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}%`;
  return <section className="reading-distribution" aria-labelledby="reading-distribution-title">
    <header className="reading-distribution__header">
      <div className="reading-distribution__title"><ChartPie size={24} aria-hidden="true" /><h2 id="reading-distribution-title">短文难度等级分布（CEFR）</h2></div>
      <p>基于已生成的 {readings.length} 篇情境短文及 {totalWords} 条精选词汇</p>
      <div className="reading-distribution__switch" role="group" aria-label="统计维度">
        {(['readings', 'vocabulary'] as const).map(value => <button key={value} type="button" aria-pressed={dimension === value} onClick={() => { setHoveredLevel(null); setFocusedLevel(null); setLocalDimension(value); onDimensionChange?.(value); }}>
          {value === 'readings' ? <BookOpen size={17} aria-hidden="true" /> : <ChartNoAxesColumn size={17} aria-hidden="true" />}{value === 'readings' ? '按短文篇数' : '按词汇难度'}
        </button>)}
      </div>
    </header>
    <div className="reading-distribution__body">
      <div className="reading-distribution__ring">
        <svg viewBox="0 0 240 240" role="group" aria-label={`${dimension === 'readings' ? '短文' : '精选词汇'}等级分布，可点击扇区筛选`}>
          <circle cx="120" cy="120" r="100" fill="none" stroke="#F0F3EC" strokeWidth="28" />
          {distribution.filter(item => item.count > 0).map(item => {
            const start = offset; offset += item.percentage;
            const interactive = item.level !== '未知';
            return <path key={item.level} className="reading-distribution__segment" d={donutSegmentPath(start, item.percentage)} fill={levels[item.level].color}
              stroke={levels[item.level].color} strokeWidth={item.level === activeLevel ? 6 : 0} {...interaction(item.level)}
              role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined}
              aria-label={interactive ? `筛选 ${item.level}：${item.count} ${unit}，${percent(item.percentage)}` : undefined}
              aria-pressed={interactive ? selectedLevel === item.level : undefined}
              onClick={interactive ? () => onLevelSelect?.(item.level) : undefined}
              onKeyDown={interactive ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onLevelSelect?.(item.level); } } : undefined} />;
          })}
        </svg>
        <div className="reading-distribution__center" aria-live="polite">
          <span>{source.length ? levels[active.level].name.toUpperCase() : 'NO DATA'}</span>
          <strong>{source.length ? (active.level === '未知' ? '未标注' : active.level) : '—'}</strong>
          <small>{source.length ? `${active.count} ${unit} · ${active.percentage.toFixed(1)}%` : '暂无等级数据'}</small>
        </div>
      </div>
      <div className="reading-distribution__details">
        <p className="reading-distribution__hint">点击等级卡片可筛选下方短文：</p>
        <div className="reading-distribution__levels" role="group" aria-label="按 CEFR 等级筛选历史短文">
          {distribution.filter(item => item.level !== '未知').map(item => <button type="button" key={item.level} {...interaction(item.level)} data-preview={activeLevel === item.level} aria-pressed={selectedLevel === item.level} onClick={() => onLevelSelect?.(item.level)}>
            <span className="reading-distribution__dot" style={{ background: levels[item.level].color }} aria-hidden="true" />
            <span className="reading-distribution__level-name"><strong>{item.level}</strong><small>{levels[item.level].name}</small></span>
            <span className="reading-distribution__numbers"><strong>{item.count}</strong><small>{percent(item.percentage)}</small></span>
          </button>)}
        </div>
        {unknown.count > 0 && <p className="reading-distribution__unknown">未标注等级：{unknown.count} {unit}（{percent(unknown.percentage)}），已计入总数。</p>}
        <div className="reading-distribution__summary"><Sparkles size={19} aria-hidden="true" /><span>主修核心等级：<strong>{source.length ? `${dominant.level === '未知' ? '未标注' : dominant.level}（${percent(dominant.percentage)}）` : '暂无数据'}</strong></span></div>
        {!source.length && <p className="reading-distribution__unknown">{dimension === 'readings' ? '保存短文后显示等级分布。' : '暂无精选词汇，生成含精选词汇的短文后显示分布。'}</p>}
      </div>
    </div>
  </section>;
}
