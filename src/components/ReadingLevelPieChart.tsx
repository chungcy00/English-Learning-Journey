import React from 'react';
import { readingLevelDistribution } from '../utils/readingLevelDistribution';

export function ReadingLevelPieChart({ readings }: { readings: readonly { cefrLevel?: string | null }[] }) {
  const distribution = readingLevelDistribution(readings);
  const slices = distribution.filter(item => item.count > 0);
  let angle = -Math.PI / 2;
  return (
    <section className="reading-distribution" aria-labelledby="reading-distribution-title">
      <h2 id="reading-distribution-title" className="type-section font-ui font-semibold">已保存短文等级分布</h2>
      {readings.length === 0 ? <p className="type-body text-[var(--text-secondary)]">保存短文后显示等级分布。</p> : (
        <div className="reading-distribution__body">
          <svg className="reading-distribution__pie" viewBox="0 0 200 200" role="img" aria-label="短文等级分布，具体篇数和占比见文字图例">
            {slices.map(item => {
              const start = angle;
              angle += item.count / readings.length * Math.PI * 2;
              const point = (value: number) => `${100 + 94 * Math.cos(value)} ${100 + 94 * Math.sin(value)}`;
              return slices.length === 1
                ? <circle key={item.level} className={`chart-level-${item.level}`} cx="100" cy="100" r="94" />
                : <path key={item.level} className={`chart-level-${item.level}`} d={`M 100 100 L ${point(start)} A 94 94 0 ${angle - start > Math.PI ? 1 : 0} 1 ${point(angle)} Z`} />;
            })}
          </svg>
          <ul className="reading-distribution__legend" aria-label="短文等级统计">
            {distribution.filter(item => item.level !== '未知' || item.count > 0).map(item => (
              <li key={item.level}><span className={`chart-key chart-level-${item.level}`} aria-hidden="true" /><span>{item.level}</span><span>{item.count} 篇</span><span>{item.percentage.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}%</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
