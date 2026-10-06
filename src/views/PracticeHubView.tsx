import React from 'react';
import { ArrowRight, BookOpen, FilePenLine } from 'lucide-react';

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
    </header>
    <div className="practice-entry-grid">
      <section className="practice-entry practice-entry--rewrite" aria-labelledby="practice-rewrite-title">
        <FilePenLine aria-hidden="true" className="practice-entry-icon" />
        <div>
          <h2 id="practice-rewrite-title" className="font-editorial font-semibold">Rewrite the Sentence</h2>
          <p className="type-label font-ui text-[var(--text-secondary)] mt-2">{exerciseCount ? `${exerciseCount} 道改写练习` : '当前短文暂无改写练习'}</p>
        </div>
        <button type="button" onClick={onOpenRewrite} className="practice-entry-action">
          进入练习 <ArrowRight aria-hidden="true" className="w-4 h-4" />
        </button>
      </section>
      <section className="practice-entry practice-entry--wordbook" aria-labelledby="practice-wordbook-title">
        <BookOpen aria-hidden="true" className="practice-entry-icon" />
        <div>
          <h2 id="practice-wordbook-title" className="font-editorial font-semibold">我的生词本</h2>
          <p className="type-label font-ui text-[var(--text-secondary)] mt-2">已添加 {vocabularyCount} 个表达</p>
        </div>
        <button type="button" onClick={onOpenWordbook} className="practice-entry-action">
          查看生词本 <ArrowRight aria-hidden="true" className="w-4 h-4" />
        </button>
      </section>
    </div>
    <section id="practice-review" className="practice-review" aria-label="词汇复习">{children}</section>
  </div>;
}
