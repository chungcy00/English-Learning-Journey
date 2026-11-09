import React from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
export function PracticeHubView({ vocabularyCount, onOpenWordbook, children }: { vocabularyCount: number; onOpenWordbook: () => void; children: React.ReactNode }) {
  return <div className="page-shell practice-hub"><header className="practice-hub-heading"><h1 className="type-page font-editorial font-semibold">词汇与复习</h1><p>查看收藏的表达，按自己的节奏复习。</p></header>
    <button type="button" className="practice-entry practice-entry--wordbook" onClick={onOpenWordbook}><span className="practice-entry-icon"><BookOpen aria-hidden="true"/></span><span className="practice-entry-copy"><span className="practice-entry-title">我的单词本</span><span className="practice-entry-description">已收藏 {vocabularyCount} 个词条 · 添加单词与词组</span></span><ArrowUpRight aria-hidden="true" className="practice-entry-arrow"/></button>
    <section id="practice-review" className="practice-review" aria-label="词汇复习">{children}</section></div>;
}
