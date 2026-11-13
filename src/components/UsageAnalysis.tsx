import React from 'react';
import { Volume2 } from 'lucide-react';
import { HandOutline } from './LearningArt';
import { USAGE_HEADINGS, type LearningEntry, type StructuredUsage, type UsageExample } from '../types';
import { compatibilityHasContent, structuredUsage, usageKinds, usageHasContent } from '../utils/structuredUsage';

function Examples({ examples, pronounce }: { examples: UsageExample[]; pronounce: (text: string) => void }) {
  return <div className="usage-examples">{examples.map(example => <div key={example.id} className="lexicon-example usage-example">
    {example.english.trim() && <button type="button" aria-label={`朗读例句：${example.english}`} onClick={() => pronounce(example.english)}><Volume2 size={17}/></button>}
    <div>{example.english.trim() && <p lang="en">{example.english}</p>}{example.chinese.trim() && <p className="lexicon-muted">{example.chinese}</p>}</div>
  </div>)}</div>;
}
function Note({ children }: { children?: string }) {
  return children?.trim() ? <p className="lexicon-note lexicon-muted">{children}</p> : null;
}
function Point({ usage, pronounce }: { usage: StructuredUsage; pronounce: (text: string) => void }) {
  switch (usage.kind) {
    case 'scenario': {
      const point = usage.scenario;
      return point && <>
        {point.name.trim() && <h5>{point.name}</h5>}
        {point.explanation.trim() && <p>{point.explanation}</p>}
        <Examples examples={point.examples} pronounce={pronounce}/>
      </>;
    }
    case 'grammar': {
      const point = usage.grammar;
      return point && <>
        {point.name.trim() && <h5>{point.name}</h5>}
        {point.explanation.trim() && <p>{point.explanation}</p>}
        {point.correct.trim() && <dl className="usage-rule"><dt>正确搭配</dt><dd lang="en">{point.correct}</dd></dl>}
        <Examples examples={point.examples} pronounce={pronounce}/>
        {(point.restriction.trim() || point.note.trim()) && <details className="usage-grammar-more">
          <summary>更多说明</summary>
          {point.restriction.trim() && <div><h6>常见错误或限制</h6><p>{point.restriction}</p></div>}
          {point.note.trim() && <div><h6>补充说明</h6><p>{point.note}</p></div>}
        </details>}
      </>;
    }
    case 'comparison': {
      const point = usage.comparison;
      return point && <>
        {point.context.trim() && <div className="usage-comparison-context"><p>{point.context}</p></div>}
        {point.difference.trim() && <p className="usage-comparison-summary">{point.difference}</p>}
        <div className="usage-comparisons">{point.expressions.map(expression => <article key={expression.id} className="usage-comparison"><HandOutline/>
          {expression.expression.trim() && <div className="usage-expression-heading"><h6 lang="en">{expression.expression}</h6><button type="button" aria-label={`朗读：${expression.expression}`} onClick={() => pronounce(expression.expression)}><Volume2 size={18}/></button></div>}
          {expression.explanation.trim() && <p className="usage-semantic-explanation">{expression.explanation}</p>}
          <Examples examples={expression.examples} pronounce={pronounce}/>
        </article>)}</div><Note>{point.note}</Note>
      </>;
    }
    case 'error': {
      const point = usage.error;
      return point && <>
        {point.name.trim() && <h5>{point.name}</h5>}
        <dl className="lexicon-usage-contrast">
          {point.incorrect.trim() && <div><dt>{point.severity === 'unnatural' ? '不够自然' : '错误表达'}</dt><dd lang="en">{point.incorrect}</dd></div>}
          {point.correct.trim() && <div><dt>{point.severity === 'unnatural' ? '自然表达' : '正确表达'}</dt><dd lang="en">{point.correct}</dd></div>}
        </dl>
        {point.reason.trim() && <p>{point.reason}</p>}
        <Examples examples={point.examples} pronounce={pronounce}/><Note>{point.note}</Note>
      </>;
    }
    default: return null;
  }
}
function Compatibility({ usage, pronounce }: { usage: StructuredUsage; pronounce: (text: string) => void }) {
  const content = usage.compatibility;
  if (!content || !compatibilityHasContent(usage)) return null;
  return <div className="usage-compatibility">
    {content.title.trim() && <h5>{content.title}</h5>}
    {content.explanation.trim() && <p>{content.explanation}</p>}
    <Examples examples={content.examples} pronounce={pronounce}/><Note>{content.note}</Note>
  </div>;
}
export function UsageList({ entries, pronounce }: { entries: LearningEntry[]; pronounce: (text: string) => void; manual?: boolean }) {
  const points = entries.map(entry => ({ id: entry.id, usage: structuredUsage(entry) })).filter(point => usageHasContent(point.usage));
  if (!points.length) return <p className="lexicon-empty">暂无补充用法解析</p>;
  return <div className="lexicon-usage-list">
    {usageKinds.map(kind => {
      const group = points.filter(point => point.usage.kind === kind);
      return group.length > 0 && <section key={kind} className={`lexicon-usage-point lexicon-usage-point--${kind}`}>
        <h4>{USAGE_HEADINGS[kind]}</h4>
        <div className={`usage-points usage-points--${kind}`}>{group.map(point => <article key={point.id} className={`usage-point usage-point--${kind}`} data-usage-kind={kind}>
          <Point usage={point.usage} pronounce={pronounce}/><Compatibility usage={point.usage} pronounce={pronounce}/>
        </article>)}</div>
      </section>;
    })}
    {points.filter(point => !point.usage.kind).map(point => <section key={point.id} className="lexicon-usage-point usage-retained-content"><h4>保留的历史内容</h4><Compatibility usage={point.usage} pronounce={pronounce}/></section>)}
  </div>;
}
