import React, { useState } from 'react';
import { BookOpen, ChartNoAxesColumn, ChartPie } from 'lucide-react';
import { distributionSource, readingLevelDistribution, type DistributionDimension, type DistributionReading } from '../utils/readingLevelDistribution';
import { donutSegmentPath } from '../utils/donutInteraction';
import { cefrVisuals, cefrStyle, formatDistributionPercent as percent } from '../utils/cefrVisuals';

export function ReadingLevelPieChart({ readings, dimension: controlledDimension, selectedLevel = null, onDimensionChange, onLevelSelect, vocabulary }: {
  readings: readonly DistributionReading[];
  vocabulary?: readonly { cefrLevel?: string | null }[];
  dimension?: DistributionDimension;
  selectedLevel?: string | null;
  onDimensionChange?: (dimension: DistributionDimension) => void;
  onLevelSelect?: (level: string) => void;
}) {
  const [localDimension, setLocalDimension] = useState<DistributionDimension>('readings');
  const dimension = controlledDimension || localDimension;
  const source = dimension === 'vocabulary' && vocabulary ? vocabulary : distributionSource(readings, dimension);
  const distribution = readingLevelDistribution(source);
  const active = distribution.find(item => item.level === selectedLevel && item.count > 0);
  const unknown = distribution.find(item => item.level === '未知')!;
  const totalWords = distributionSource(readings, 'vocabulary').length;
  const unit = dimension === 'readings' ? '篇' : '词';
  const levelLabel = (level: string) => level === '未知' ? '未标注' : level;
  let offset = 0;
  return <section className="reading-distribution history-distribution-final" aria-labelledby="reading-distribution-title">
    <header className="reading-distribution__header">
      <div className="reading-distribution__title"><ChartPie size={23} aria-hidden="true" /><h2 id="reading-distribution-title">{dimension === 'readings' ? '短文难度等级分布' : '词汇难度等级分布'}（CEFR）</h2></div>
      <p>{dimension === 'vocabulary' && vocabulary ? `基于本机已收录的 ${vocabulary.length} 个可复习词条` : `基于已生成的 ${readings.length} 篇情境短文及 ${totalWords} 条精选词汇`}</p>
      <div className="reading-distribution__switch" role="group" aria-label="统计维度" data-dimension={dimension}>
        {(['readings', 'vocabulary'] as const).map(value => <button key={value} type="button" aria-pressed={dimension === value} onClick={() => { setLocalDimension(value); if (value !== dimension) onDimensionChange?.(value); }}>
          {value === 'readings' ? <BookOpen size={17} aria-hidden="true" /> : <ChartNoAxesColumn size={17} aria-hidden="true" />}{value === 'readings' ? '按短文篇数' : '按词汇难度'}
        </button>)}
      </div>
    </header>
    <div className="reading-distribution__body">
      <div className="reading-distribution__ring">
        <svg viewBox="0 0 240 240" role="group" aria-label={`${dimension === 'readings' ? '短文' : vocabulary ? '已收录词汇' : '精选词汇'}等级分布，可点击扇区筛选`}>
          <circle cx="120" cy="120" r="94" fill="none" stroke="var(--surface-disabled)" strokeWidth="40" />
          {distribution.filter(item => item.count > 0).map(item => {
            const start = offset; offset += item.percentage;
            const interactive = item.level !== '未知' || dimension === 'vocabulary';
            return <path key={item.level} className="reading-distribution__segment" d={donutSegmentPath(start, item.percentage, 114, 74)} fill={cefrVisuals[item.level].color}
              style={{ opacity: active && item.level !== active.level ? .2 : 1 }}
              stroke="var(--surface-paper)" strokeWidth={1}
              role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined}
              aria-label={interactive ? `筛选 ${levelLabel(item.level)}：${item.count} ${unit}，${percent(item.percentage)}` : undefined}
              aria-pressed={interactive ? active?.level === item.level : undefined}
              onClick={interactive ? () => onLevelSelect?.(item.level) : undefined}
              onKeyDown={interactive ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onLevelSelect?.(item.level); } } : undefined}><title>{levelLabel(item.level)}：{item.count} {unit}，{percent(item.percentage)}</title></path>;
          })}
        </svg>
        <div className="reading-distribution__center" aria-live="polite" aria-atomic="true">
          <span>{active ? levelLabel(active.level) : '总计'}</span>
          <strong>{active?.count ?? source.length} {unit}</strong>
          <small>{active ? percent(active.percentage) : dimension === 'readings' ? '学习短文' : vocabulary ? '已收录词汇' : '精选词汇'}</small>
        </div>
      </div>
      <div className="history-chart-legend" role="group" aria-label="等级图例">{distribution.filter(item => item.count > 0).map(item => <button type="button" key={item.level} disabled={item.level === '未知' && dimension !== 'vocabulary'} aria-pressed={active?.level === item.level} aria-label={`图例 ${levelLabel(item.level)}：${item.count} ${unit}，${percent(item.percentage)}`} style={cefrStyle(item.level)} onClick={() => onLevelSelect?.(item.level)}><span className="reading-distribution__dot" aria-hidden="true"/>{levelLabel(item.level)}</button>)}</div>
      <div className="reading-distribution__details">
        <p className="reading-distribution__hint">{dimension === 'readings' ? '点击圆环、等级卡片或图例，可筛选对应的历史短文。' : '点击圆环、等级卡片或图例，查看分级词汇复习。'}</p>
        <div className="reading-distribution__levels" role="group" aria-label={dimension === 'readings' ? '按 CEFR 等级筛选历史短文' : '选择词汇复习等级'}>
          {distribution.filter(item => dimension === 'vocabulary' || item.level !== '未知').map(item => <button type="button" key={item.level} disabled={!item.count} style={cefrStyle(item.level)} aria-label={`${levelLabel(item.level)} ${cefrVisuals[item.level].name}：${item.count} ${unit}，${percent(item.percentage)}`} aria-pressed={active?.level === item.level} onClick={() => onLevelSelect?.(item.level)}>
            <span className="reading-distribution__dot" aria-hidden="true" />
            <span className="reading-distribution__level-name"><strong>{levelLabel(item.level)}</strong><small>{cefrVisuals[item.level].name}</small></span>
            <span className="reading-distribution__numbers"><strong>{item.count}</strong><small>{percent(item.percentage)}</small></span>
          </button>)}
        </div>
        {dimension === 'readings' && unknown.count > 0 && <p className="reading-distribution__unknown">未标注等级：{unknown.count} {unit}（{percent(unknown.percentage)}），已计入总数。</p>}
        {active && dimension === 'readings' && <div className="history-cefr-filter" role="status" style={cefrStyle(active.level)}><span><i className="reading-distribution__dot" aria-hidden="true"/>当前筛选：{active.level}（{active.count} {unit}）</span><button type="button" onClick={() => onLevelSelect?.(active.level)}>清除筛选</button></div>}
        {!source.length && <p className="reading-distribution__unknown">{dimension === 'readings' ? '保存短文后显示等级分布。' : '暂无已收录词汇等级数据。'}</p>}
      </div>
    </div>
  </section>;
}
