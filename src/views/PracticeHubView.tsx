import React from 'react';
import { ArrowUpRight, BookOpen, FilePenLine } from 'lucide-react';

interface PracticeHubViewProps {
  exerciseCount: number;
  vocabularyCount: number;
  onOpenRewrite: () => void;
  onOpenWordbook: () => void;
  children: React.ReactNode;
}

export function PracticeHubView({ exerciseCount, vocabularyCount, onOpenRewrite, onOpenWordbook, children }: PracticeHubViewProps) {
  return <div className="page-shell practice-hub">
    <header className="practice-hub-heading">
      <h1 className="type-page font-editorial font-semibold">练习与生词</h1>
      <p>巩固所学，让每一次阅读都有收获。</p>
    </header>
    <div className="practice-entry-grid">
      <button type="button" className="practice-entry practice-entry--rewrite" onClick={onOpenRewrite} disabled={exerciseCount === 0}>
        <span className="practice-entry-icon"><FilePenLine aria-hidden="true" /></span>
        <span className="practice-entry-copy"><span className="practice-entry-title">句子改写</span><span className="practice-entry-description">{exerciseCount ? `${exerciseCount} 道练习 · 巩固英文表达` : '当前短文暂无改写练习'}</span></span>
        <ArrowUpRight aria-hidden="true" className="practice-entry-arrow" />
      </button>
      <button type="button" className="practice-entry practice-entry--wordbook" onClick={onOpenWordbook}>
        <span className="practice-entry-icon"><BookOpen aria-hidden="true" /></span>
        <span className="practice-entry-copy"><span className="practice-entry-title">我的生词本</span><span className="practice-entry-description">已添加 {vocabularyCount} 个表达</span></span>
        <ArrowUpRight aria-hidden="true" className="practice-entry-arrow" />
      </button>
    </div>
    <section id="practice-review" className="practice-review" aria-label="词汇复习">{children}</section>
  </div>;
}
