import { HandOutline, Companion } from '../components/LearningArt';
import React from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
export function PracticeHubView({ vocabularyCount, onOpenWordbook, children }: { vocabularyCount: number; onOpenWordbook: () => void; children: React.ReactNode }) {
  return <div className="page-shell practice-hub">
    <button type="button" className="practice-entry practice-entry--wordbook" onClick={onOpenWordbook}><HandOutline/><Companion className="wordbook-entry-companion"/><span className="practice-entry-icon"><BookOpen aria-hidden="true"/></span><span className="practice-entry-copy"><span className="practice-entry-title">我的单词本</span><span className="practice-entry-description">已收藏 {vocabularyCount} 个词条 · 全部短文与自定义词汇</span></span><ArrowUpRight aria-hidden="true" className="practice-entry-arrow"/></button>
    <section id="practice-review" className="practice-review" aria-label="词汇复习">{children}</section></div>;
}
