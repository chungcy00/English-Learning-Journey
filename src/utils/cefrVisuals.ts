import type { CSSProperties } from 'react';

export const cefrVisuals: Record<string, { name: string; color: string; background: string; text: string }> = {
  A1: { name: '入门', color: '#A9B7A6', background: '#F1F4EF', text: '#53634F' },
  A2: { name: '基础', color: '#E6C394', background: '#F9F0E3', text: '#795C32' },
  B1: { name: '中级', color: '#97AB8D', background: '#EBF1E7', text: '#4B6242' },
  B2: { name: '中高级', color: '#B69CAF', background: '#F4EBF2', text: '#71576B' },
  C1: { name: '高级', color: '#9EAEAE', background: '#EFF3F2', text: '#4E6363' },
  C2: { name: '精通', color: '#C1B8AC', background: '#F3F0EC', text: '#665E53' },
  未知: { name: '未标注', color: '#BFC5BD', background: '#F1F2EE', text: '#5F655D' },
};
export function cefrStyle(level: string): CSSProperties {
  const value = cefrVisuals[level === '未标注' ? '未知' : level] || cefrVisuals['未知'];
  return { '--cefr-color': value.color, '--cefr-background': value.background, '--cefr-text': value.text } as CSSProperties;
}
export const formatDistributionPercent = (value: number) => `${value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}%`;
