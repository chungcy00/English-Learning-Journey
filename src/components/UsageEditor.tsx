import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { HandOutline } from './LearningArt';
import { USAGE_HEADINGS, type LearningEntry, type StructuredUsage, type UsageExample, type UsageKind } from '../types';
import { compatibilityHasContent, emptyUsage, structuredUsage, usageEntry, usageKinds } from '../utils/structuredUsage';

type FieldProps = { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; optional?: boolean; placeholder?: string };
function Field({ label, value, onChange, multiline = false, optional = false, placeholder }: FieldProps) {
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!area.current) return;
    area.current.style.height = 'auto';
    area.current.style.height = `${area.current.scrollHeight}px`;
  }, [value, multiline]);
  return <label className={`usage-field${multiline ? ' usage-field--wide' : ''}`}>
    <span>{label}{optional ? '（选填）' : ''}</span>
    {multiline ? <textarea ref={area} rows={1} value={value} placeholder={placeholder} maxLength={3000}
      onChange={event => onChange(event.target.value)} onInput={event => {
        event.currentTarget.style.height = 'auto';
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
      }}/>
      : <input value={value} placeholder={placeholder} maxLength={3000} onChange={event => onChange(event.target.value)}/>}
  </label>;
}

function OrderActions({ label, first, last, onMove, onRemove }: {
  label: string; first: boolean; last: boolean; onMove: (direction: number) => void; onRemove: () => void;
}) {
  return <div className="usage-order-actions">
    <button type="button" aria-label={`上移${label}`} title="上移" disabled={first} onClick={() => onMove(-1)}><ArrowUp size={16}/></button>
    <button type="button" aria-label={`下移${label}`} title="下移" disabled={last} onClick={() => onMove(1)}><ArrowDown size={16}/></button>
    <button type="button" aria-label={`删除${label}`} title="删除" onClick={onRemove}><Trash2 size={16}/></button>
  </div>;
}

function move<T>(items: T[], index: number, direction: number): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function summarize(text: string, max = 96) {
  const value = text.trim().replace(/\s+/g, ' ');
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function usageTitle(usage: StructuredUsage) {
  if (usage.kind === 'scenario') return usage.scenario?.name.trim() || '未命名使用场景';
  if (usage.kind === 'grammar') return usage.grammar?.name.trim() || '未命名搭配规则';
  if (usage.kind === 'comparison') return usage.comparison?.context.trim() || '未命名比较情境';
  if (usage.kind === 'error') return usage.error?.name.trim() || '未命名常见错误';
  return usage.compatibility?.title.trim() || '未整理的历史内容';
}

function usageSummary(usage: StructuredUsage) {
  if (usage.kind === 'scenario') return summarize(usage.scenario?.explanation || '');
  if (usage.kind === 'grammar') return summarize(usage.grammar?.explanation || '');
  if (usage.kind === 'comparison') return summarize(usage.comparison?.difference || '');
  if (usage.kind === 'error') return summarize(usage.error?.reason || usage.error?.correct || '');
  return summarize(usage.compatibility?.explanation || '');
}

function usageCounts(usage: StructuredUsage) {
  if (usage.kind === 'comparison') {
    const expressions = usage.comparison?.expressions || [];
    const examples = expressions.reduce((total, item) => total + item.examples.length, 0);
    return `${expressions.length} 个对比表达${examples ? ` · ${examples} 组例句` : ''}`;
  }
  if (usage.kind === 'scenario') return `${usage.scenario?.examples.length || 0} 组例句`;
  if (usage.kind === 'grammar') return `${usage.grammar?.examples.length || 0} 组例句`;
  if (usage.kind === 'error') return `${usage.error?.examples.length || 0} 组修正例句`;
  return `${usage.compatibility?.examples.length || 0} 组历史例句`;
}

function ExampleListEditor({ examples, onChange, label }: {
  examples: UsageExample[]; onChange: (examples: UsageExample[]) => void; label: string;
}) {
  return <div className="usage-examples-editor">
    <div className="usage-subsection-heading"><h6>{label} <span>({examples.length})</span></h6>
      <button type="button" className="lexicon-link usage-inline-add" onClick={() => onChange([...examples, { id: crypto.randomUUID(), english: '', chinese: '' }])}><Plus size={15}/>添加</button>
    </div>
    {examples.map((example, index) => <div key={example.id} className="usage-example-editor">
      <div className="usage-example-editor__heading"><span>{label} {index + 1}</span>
        <OrderActions label={`${label} ${index + 1}`} first={index === 0} last={index === examples.length - 1}
          onMove={direction => onChange(move(examples, index, direction))}
          onRemove={() => onChange(examples.filter((_, i) => i !== index))}/>
      </div>
      <Field label={`英文${label} ${index + 1}`} value={example.english} multiline placeholder="英文原句" onChange={english => onChange(examples.map((item, i) => i === index ? { ...item, english } : item))}/>
      <Field label={`中文译文 ${index + 1}`} value={example.chinese} multiline placeholder="对应的中文译文" onChange={chinese => onChange(examples.map((item, i) => i === index ? { ...item, chinese } : item))}/>
    </div>)}
  </div>;
}

function ExpressionListEditor({ expressions, onChange, openIds, setOpenIds }: {
  expressions: NonNullable<StructuredUsage['comparison']>['expressions'];
  onChange: (expressions: NonNullable<StructuredUsage['comparison']>['expressions']) => void;
  openIds: Set<string>; setOpenIds: (update: (previous: Set<string>) => Set<string>) => void;
}) {
  const setExpression = (id: string, change: Partial<(typeof expressions)[number]>) => onChange(expressions.map(item => item.id === id ? { ...item, ...change } : item));
  const changeOpen = (id: string) => setOpenIds(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return <div className="usage-expression-editors">
    <div className="usage-subsection-heading"><h6>对比表达 <span>({expressions.length})</span></h6>
      <button type="button" className="lexicon-link usage-inline-add" onClick={() => {
        const id = crypto.randomUUID();
        onChange([...expressions, { id, expression: '', explanation: '', examples: [] }]);
        setOpenIds(previous => new Set(previous).add(id));
      }}><Plus size={15}/>添加表达</button>
    </div>
    {expressions.map((expression, index) => {
      const open = openIds.has(expression.id);
      return <div className="usage-expression-editor" key={expression.id}>
        <div className="usage-expression-editor__heading">
          <button type="button" className="usage-item-toggle usage-expression-toggle" aria-expanded={open} onClick={() => changeOpen(expression.id)}>
            <span className="usage-item-copy"><strong lang="en">{expression.expression.trim() || `对比表达 ${index + 1}`}</strong>
              {expression.explanation.trim() && <span>{summarize(expression.explanation, 72)}</span>}
              <small>{expression.examples.length} 组例句</small>
            </span>
          </button>
          <div className="usage-item-controls">
            <OrderActions label={`对比表达 ${index + 1}`} first={index === 0} last={index === expressions.length - 1}
              onMove={direction => onChange(move(expressions, index, direction))}
              onRemove={() => onChange(expressions.filter((_, i) => i !== index))}/>
            <button type="button" className="usage-item-disclosure" aria-label={`${open ? '收起' : '展开'}对比表达 ${index + 1}`} aria-expanded={open} onClick={() => changeOpen(expression.id)}>
              <ChevronDown className="usage-disclosure-chevron" size={18} aria-hidden="true"/>
            </button>
          </div>
        </div>
        {open && <div className="usage-expression-editor__content">
          <Field label="单词或词组" value={expression.expression} placeholder="输入英文表达" onChange={value => setExpression(expression.id, { expression: value })}/>
          <Field label="中文语义说明" value={expression.explanation} multiline placeholder="说明基本意思和与其他表达的区别" onChange={value => setExpression(expression.id, { explanation: value })}/>
          <ExampleListEditor label="例句" examples={expression.examples} onChange={examples => setExpression(expression.id, { examples })}/>
        </div>}
      </div>;
    })}
  </div>;
}

function CategoryFields({ usage, onChange, openExpressionIds, setOpenExpressionIds }: {
  usage: StructuredUsage; onChange: (usage: StructuredUsage) => void;
  openExpressionIds: Set<string>; setOpenExpressionIds: (update: (previous: Set<string>) => Set<string>) => void;
}) {
  switch (usage.kind) {
    case 'scenario': {
      const value = usage.scenario!;
      const patch = (change: Partial<typeof value>) => onChange({ ...usage, scenario: { ...value, ...change } });
      const tipFilled = !!value.tip.trim();
      return <>
        <Field label="场景名称" value={value.name} placeholder="例如：婉拒他人请求" onChange={name => patch({ name })}/>
        <Field label="中文用法说明" value={value.explanation} multiline placeholder="说明这个词适用的具体语境" onChange={explanation => patch({ explanation })}/>
        <ExampleListEditor label="例句" examples={value.examples} onChange={examples => patch({ examples })}/>
        <details className="usage-more-options">
          <summary>使用提示{tipFilled && <span className="usage-filled-indicator">已填写</span>}</summary>
          <div className="usage-optional-fields"><Field label="使用提示" value={value.tip} multiline optional onChange={tip => patch({ tip })}/></div>
        </details>
      </>;
    }
    case 'grammar': {
      const value = usage.grammar!;
      const patch = (change: Partial<typeof value>) => onChange({ ...usage, grammar: { ...value, ...change } });
      const optionalFilled = !!(value.restriction.trim() || value.note.trim());
      return <>
        <Field label="搭配规则名称" value={value.name} placeholder="例如：interfere with" onChange={name => patch({ name })}/>
        <Field label="中文规则说明" value={value.explanation} multiline placeholder="说明搭配的用法和限制" onChange={explanation => patch({ explanation })}/>
        <Field label="正确搭配" value={value.correct} multiline optional placeholder="填写后会作为辅助说明显示" onChange={correct => patch({ correct })}/>
        <ExampleListEditor label="例句" examples={value.examples} onChange={examples => patch({ examples })}/>
        <details className="usage-more-options">
          <summary>更多选项{optionalFilled && <span className="usage-filled-indicator">已填写</span>}</summary>
          <div className="usage-optional-fields">
            <Field label="常见错误或限制" value={value.restriction} multiline optional onChange={restriction => patch({ restriction })}/>
            <Field label="补充说明" value={value.note} multiline optional onChange={note => patch({ note })}/>
          </div>
        </details>
      </>;
    }
    case 'comparison': {
      const value = usage.comparison!;
      const patch = (change: Partial<typeof value>) => onChange({ ...usage, comparison: { ...value, ...change } });
      return <>
        <Field label="比较情境" value={value.context} multiline placeholder="说明比较发生的语境" onChange={context => patch({ context })}/>
        <Field label="核心区别" value={value.difference} multiline placeholder="简洁概括这些表达的关键区别" onChange={difference => patch({ difference })}/>
        <ExpressionListEditor expressions={value.expressions} onChange={expressions => patch({ expressions })} openIds={openExpressionIds} setOpenIds={setOpenExpressionIds}/>
        <details className="usage-more-options">
          <summary>补充说明{value.note.trim() && <span className="usage-filled-indicator">已填写</span>}</summary>
          <div className="usage-optional-fields"><Field label="补充说明" value={value.note} multiline optional onChange={note => patch({ note })}/></div>
        </details>
      </>;
    }
    case 'error': {
      const value = usage.error!;
      const patch = (change: Partial<typeof value>) => onChange({ ...usage, error: { ...value, ...change } });
      const optionalFilled = !!value.note.trim();
      return <>
        <Field label="错误类型" value={value.name} placeholder="例如：介词搭配" onChange={name => patch({ name })}/>
        <label className="usage-field">表达问题性质<select value={value.severity} onChange={event => patch({ severity: event.target.value as typeof value.severity })}>
          <option value="incorrect">真正的错误</option><option value="unnatural">表达不够自然</option>
        </select></label>
        <div className="usage-error-pair">
          <Field label={value.severity === 'incorrect' ? '错误表达' : '不自然的表达'} value={value.incorrect} multiline placeholder="输入需要修正的表达" onChange={incorrect => patch({ incorrect })}/>
          <Field label="正确表达" value={value.correct} multiline placeholder="输入正确、自然的表达" onChange={correct => patch({ correct })}/>
        </div>
        <Field label={value.severity === 'incorrect' ? '错误原因' : '改进原因'} value={value.reason} multiline placeholder="说明问题原因" onChange={reason => patch({ reason })}/>
        <ExampleListEditor label="修正例句" examples={value.examples} onChange={examples => patch({ examples })}/>
        <details className="usage-more-options">
          <summary>补充说明{optionalFilled && <span className="usage-filled-indicator">已填写</span>}</summary>
          <div className="usage-optional-fields"><Field label="补充说明" value={value.note} multiline optional onChange={note => patch({ note })}/></div>
        </details>
      </>;
    }
    default: return null;
  }
}

export function UsageEditor({ entries, onChange }: { entries: LearningEntry[]; onChange: (entries: LearningEntry[]) => void }) {
  const [openCategories, setOpenCategories] = useState<Set<UsageKind>>(() => new Set());
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());
  const [openExpressions, setOpenExpressions] = useState<Set<string>>(() => new Set());
  const [openHistory, setOpenHistory] = useState(false);
  const update = (id: string, usage: StructuredUsage) => onChange(entries.map(entry => entry.id === id ? usageEntry(id, usage) : entry));
  const groups = new Map(usageKinds.map(kind => [kind, entries.filter(entry => structuredUsage(entry).kind === kind)]));
  const history = entries.filter(entry => !structuredUsage(entry).kind && compatibilityHasContent(structuredUsage(entry)));
  const addItem = (kind: UsageKind) => {
    const id = crypto.randomUUID();
    onChange([...entries, usageEntry(id, emptyUsage(kind))]);
    setOpenCategories(previous => new Set(previous).add(kind));
    setOpenItems(previous => new Set(previous).add(id));
  };
  const toggleCategory = (kind: UsageKind) => setOpenCategories(previous => {
    const next = new Set(previous);
    if (next.has(kind)) next.delete(kind); else next.add(kind);
    return next;
  });
  const toggleItem = (id: string) => setOpenItems(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allExpanded = openCategories.size === usageKinds.length && entries.every(entry => openItems.has(entry.id)) && (!history.length || openHistory);
  const expandAll = () => {
    setOpenCategories(new Set(usageKinds));
    setOpenItems(new Set(entries.map(entry => entry.id)));
    setOpenExpressions(new Set(entries.flatMap(entry => structuredUsage(entry).comparison?.expressions.map(expression => expression.id) || [])));
    setOpenHistory(history.length > 0);
  };
  const collapseAll = () => {
    setOpenCategories(new Set());
    setOpenItems(new Set());
    setOpenExpressions(new Set());
    setOpenHistory(false);
  };
  const renderItem = (entry: LearningEntry, index: number, group: LearningEntry[], kind: UsageKind | undefined) => {
    const usage = structuredUsage(entry);
    const title = usageTitle(usage);
    const summary = usageSummary(usage);
    const open = openItems.has(entry.id);
    const old = usage.compatibility;
    const label = `${kind ? USAGE_HEADINGS[kind] : '历史内容'} ${index + 1}`;
    return <article key={entry.id} className="usage-item-editor">
      <div className="usage-item-editor__heading">
        <button type="button" className="usage-item-toggle" aria-expanded={open} aria-label={`${open ? '收起' : '展开'}${label}`} onClick={() => toggleItem(entry.id)}>
          <span className="usage-item-copy"><strong>{title}</strong>{summary && <span>{summary}</span>}<small>{usageCounts(usage)}</small></span>
        </button>
        <div className="usage-item-controls">
          <OrderActions label={label} first={index === 0} last={index === group.length - 1}
            onRemove={() => { onChange(entries.filter(item => item.id !== entry.id)); setOpenItems(previous => { const next = new Set(previous); next.delete(entry.id); return next; }); }}
            onMove={direction => {
              const other = group[index + direction];
              if (!other) return;
              const next = [...entries];
              const a = next.findIndex(item => item.id === entry.id), b = next.findIndex(item => item.id === other.id);
              [next[a], next[b]] = [next[b], next[a]];
              onChange(next);
            }}/>
          <button type="button" className="usage-item-disclosure" aria-label={`${open ? '收起' : '展开'}${label}`} aria-expanded={open} onClick={() => toggleItem(entry.id)}>
            <ChevronDown className="usage-disclosure-chevron" size={18} aria-hidden="true"/>
          </button>
        </div>
      </div>
      {open && <div className="usage-item-editor__content">
        <CategoryFields usage={usage} onChange={next => update(entry.id, next)} openExpressionIds={openExpressions} setOpenExpressionIds={setOpenExpressions}/>
        {old && compatibilityHasContent(usage) && <details className="usage-compatibility-editor">
          <summary>未整理的历史资料 <span className="usage-filled-indicator">含历史内容</span></summary>
          <div className="usage-optional-fields">
            <Field label="历史标题或表达" value={old.title} onChange={title => update(entry.id, { ...usage, compatibility: { ...old, title } })}/>
            <Field label="历史说明" value={old.explanation} multiline onChange={explanation => update(entry.id, { ...usage, compatibility: { ...old, explanation } })}/>
            <Field label="历史补充说明" value={old.note} multiline optional onChange={note => update(entry.id, { ...usage, compatibility: { ...old, note } })}/>
            <ExampleListEditor label="历史例句" examples={old.examples} onChange={examples => update(entry.id, { ...usage, compatibility: { ...old, examples } })}/>
          </div>
        </details>}
      </div>}
    </article>;
  };
  return <div className="usage-editor">
    <div className="usage-editor-toolbar">
      <span className="usage-editor-total">{entries.length} 个用法要点</span>
      <div><button type="button" className="lexicon-link" disabled={allExpanded} onClick={expandAll}>全部展开</button>
        <button type="button" className="lexicon-link" disabled={!openCategories.size && !openItems.size} onClick={collapseAll}>全部收起</button></div>
    </div>
    {usageKinds.map(kind => {
      const group = groups.get(kind) || [];
      const categoryOpen = openCategories.has(kind);
      return <section key={kind} className="usage-editor-group art-anchor">
        <HandOutline/>
        <div className="usage-editor-category-heading">
          <button type="button" className="usage-category-toggle" aria-expanded={categoryOpen} onClick={() => toggleCategory(kind)}>
            <strong>{USAGE_HEADINGS[kind]}</strong><span className="usage-category-count">{group.length}</span>
            <ChevronDown className="usage-disclosure-chevron" size={18} aria-hidden="true"/>
          </button>
          <button type="button" className="lexicon-link usage-inline-add" onClick={() => addItem(kind)}><Plus size={15}/>添加</button>
        </div>
        {categoryOpen && group.length > 0 && <div className="usage-editor-category-content">
          {group.map((entry, index) => renderItem(entry, index, group, kind))}
        </div>}
      </section>;
    })}
    {history.length > 0 && <details className="usage-history-editor" open={openHistory} onToggle={event => setOpenHistory(event.currentTarget.open)}>
      <summary>未整理的历史资料 <span>{history.length}</span><ChevronDown className="usage-disclosure-chevron" size={18} aria-hidden="true"/></summary>
      <div className="usage-editor-category-content">{history.map((entry, index) => renderItem(entry, index, history, undefined))}</div>
    </details>}
  </div>;
}
