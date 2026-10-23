import React, { forwardRef } from 'react';
import { BookOpen, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react';
import type { RewriteEvaluation } from '../types';
import { rewriteExamples } from '../utils/rewriteFeedback';

export const RewriteFeedback = forwardRef<HTMLElement, { evaluation: RewriteEvaluation }>(function RewriteFeedback({ evaluation }, ref) {
  const highlights = evaluation.whatYouDidWell.filter(text => text.trim());
  const issues = evaluation.issues.filter(issue => issue.original.trim() || issue.correction.trim() || issue.explanation.trim());
  const examples = rewriteExamples(evaluation);
  return <section ref={ref} className="rewrite-feedback" aria-label="评估反馈" tabIndex={-1}>
    <header className="rewrite-feedback-heading"><h3><Sparkles aria-hidden="true" size={20} />评估反馈</h3>
      {evaluation.rating && <span className={`rewrite-rating ${evaluation.rating === 'Needs Improvement' ? 'rewrite-rating--improve' : 'rewrite-rating--good'}`}>{evaluation.rating}</span>}
    </header>
    {evaluation.meaningPreserved && evaluation.targetUsedCorrectly && <p className="rewrite-feedback-meta">原意保留 · 目标词汇使用正确</p>}
    {!!highlights.length && <section className="rewrite-feedback-module"><h4><CheckCircle2 aria-hidden="true" size={18} />亮点表现</h4>
      <ul className="rewrite-feedback-points">{highlights.map((point, index) => <li key={index}>{point}</li>)}</ul>
    </section>}
    {!!issues.length && <section className="rewrite-feedback-module"><h4><Lightbulb aria-hidden="true" size={18} className="rewrite-feedback-warm" />改进建议</h4>
      <div className="rewrite-feedback-issues">{issues.map((issue, index) => <div key={index}>
        {issue.explanation.trim() && <p>{issue.explanation}</p>}
        {issue.original.trim() && <p className="rewrite-expression-original"><span>原表达</span>{issue.original}</p>}
        {issue.correction.trim() && <div className="rewrite-recommendation"><span className="rewrite-feedback-meta">推荐表达</span><p><mark>{issue.correction}</mark></p></div>}
      </div>)}</div>
    </section>}
    {!!examples.length && <section className="rewrite-feedback-module"><h4><BookOpen aria-hidden="true" size={18} />参考范例与润色</h4>
      <div className="rewrite-feedback-examples">{examples.map((example, index) => <div key={index}>
        {example.label && <span className="rewrite-feedback-meta">{example.label}</span>}<p>{example.text}</p>
      </div>)}</div>
    </section>}
  </section>;
});
