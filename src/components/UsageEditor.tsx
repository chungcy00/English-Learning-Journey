import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { HandOutline } from './LearningArt';
import { EditorOrderActions, moveEditorItems, useEditorUndo } from './EditorControls';
import { AutoTextarea } from './AutoTextarea';
import { USAGE_HEADINGS, type LearningEntry, type StructuredUsage, type UsageExample, type UsageKind } from '../types';
import { emptyUsage, structuredUsage, usageEntry, usageKinds } from '../utils/structuredUsage';

type FieldProps = { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; optional?: boolean; placeholder?: string };
function Field({ label, value, onChange, multiline = false, optional = false, placeholder }: FieldProps) {
  return <label className={`usage-field${multiline ? ' usage-field--wide' : ''}`}>
    <span>{label}{optional ? '（选填）' : ''}</span>
    {multiline ? <AutoTextarea data-editor-required={!optional || undefined} aria-required={!optional} value={value} placeholder={placeholder} maxLength={3000} onChange={onChange}/>
      : <input data-editor-required={!optional || undefined} aria-required={!optional} value={value} placeholder={placeholder} maxLength={3000} onChange={event => onChange(event.target.value)}/>}
  </label>;
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
  return '用法要点';
}

function usageSummary(usage: StructuredUsage) {
  if (usage.kind === 'scenario') return summarize(usage.scenario?.explanation || '');
  if (usage.kind === 'grammar') return summarize(usage.grammar?.explanation || '');
  if (usage.kind === 'comparison') return summarize(usage.comparison?.difference || '');
  if (usage.kind === 'error') return summarize(usage.error?.reason || usage.error?.correct || '');
  return '';
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
  return '暂无例句';
}

type FieldUpdate<T> = { [K in keyof T]?: T[K] | ((current: T[K]) => T[K]) };
type ValueUpdate<T> = T | ((current: T) => T);
function applyUpdates<T extends object>(value: T, change: FieldUpdate<T>): T {
  const next = { ...value };
  for (const key of Object.keys(change) as (keyof T)[]) {
    const update = change[key];
    (next as Record<keyof T, unknown>)[key] = typeof update === 'function' ? (update as (current: T[typeof key]) => T[typeof key])(value[key]) : update;
  }
  return next;
}

export function ExampleListEditor({ examples, onChange, label, collapsible = false }: {
  examples: UsageExample[]; onChange: (examples: ValueUpdate<UsageExample[]>) => void; label: string; collapsible?: boolean;
}) {
  const recordEditorUndo = useEditorUndo();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const addButton = <button type="button" className="lexicon-link usage-inline-add" onClick={event => {
    event.preventDefault();
    if (detailsRef.current) detailsRef.current.open = true;
    onChange(current => [...current, { id: crypto.randomUUID(), english: '', chinese: '' }]);
  }}><Plus size={15}/>添加</button>;
  const heading = <><span>{label} <small>({examples.length})</small></span>{addButton}</>;
  const fields = <>{examples.map((example, index) => <div key={example.id} className="usage-example-editor">
      <div className="usage-example-editor__heading"><span>{label} {index + 1}</span>
        <EditorOrderActions className="usage-order-actions" label={`${label} ${index + 1}`} first={index === 0} last={index === examples.length - 1}
          onMove={direction => onChange(current => moveEditorItems(current, index, direction))}
          onRemove={() => {
            onChange(current => current.filter(item => item.id !== example.id));
            recordEditorUndo(() => onChange(current => current.some(item => item.id === example.id) ? current : [...current.slice(0, Math.min(index, current.length)), example, ...current.slice(Math.min(index, current.length))]));
          }}/>
      </div>
      <Field label="英文原句" value={example.english} multiline placeholder="英文原句" onChange={english => onChange(current => current.map(item => item.id === example.id ? { ...item, english } : item))}/>
      <Field label="中文译文" value={example.chinese} multiline placeholder="对应的中文译文" onChange={chinese => onChange(current => current.map(item => item.id === example.id ? { ...item, chinese } : item))}/>
    </div>)}</>;
  return collapsible
    ? <details ref={detailsRef} className="usage-examples-editor lexicon-editor-optional" open={examples.length > 0 || undefined}><summary className="usage-subsection-heading">{heading}</summary>{fields}</details>
    : <div className="usage-examples-editor"><div className="usage-subsection-heading">{heading}</div>{fields}</div>;
}

function ExpressionListEditor({ expressions, onChange, openIds, setOpenIds }: {
  expressions: NonNullable<StructuredUsage['comparison']>['expressions'];
  onChange: (expressions: ValueUpdate<NonNullable<StructuredUsage['comparison']>['expressions']>) => void;
  openIds: Set<string>; setOpenIds: (update: (previous: Set<string>) => Set<string>) => void;
}) {
  const recordEditorUndo = useEditorUndo();
  const setExpression = (id: string, change: FieldUpdate<(typeof expressions)[number]>) => onChange(current => current.map(item => item.id === id ? applyUpdates(item, change) : item));
  const changeOpen = (id: string) => setOpenIds(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return <div className="usage-expression-editors">
    <div className="usage-subsection-heading"><h6>对比表达 <span>({expressions.length})</span></h6>
      <button type="button" className="lexicon-link usage-inline-add" onClick={() => {
        const id = crypto.randomUUID();
        onChange(current => [...current, { id, expression: '', explanation: '', examples: [] }]);
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
            <ChevronDown className="usage-disclosure-chevron" size={18} aria-hidden="true"/>
          </button>
          <div className="usage-item-controls">
            <EditorOrderActions className="usage-order-actions" label={`对比表达 ${index + 1}`} first={index === 0} last={index === expressions.length - 1}
              onMove={direction => onChange(current => moveEditorItems(current, index, direction))}
              onRemove={() => {
                onChange(current => current.filter(item => item.id !== expression.id));
                recordEditorUndo(() => {
                  onChange(current => current.some(item => item.id === expression.id) ? current : [...current.slice(0, Math.min(index, current.length)), expression, ...current.slice(Math.min(index, current.length))]);
                  setOpenIds(previous => new Set(previous).add(expression.id));
                }, '对比表达已删除');
              }}/>
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
  usage: StructuredUsage; onChange: (usage: ValueUpdate<StructuredUsage>) => void;
  openExpressionIds: Set<string>; setOpenExpressionIds: (update: (previous: Set<string>) => Set<string>) => void;
}) {
  switch (usage.kind) {
    case 'scenario': {
      const value = usage.scenario!;
      const patch = (change: FieldUpdate<typeof value>) => onChange(current => ({ ...current, scenario: applyUpdates(current.scenario!, change) }));
      const tipFilled = !!value.tip.trim();
      return <>
        <Field label="场景名称" value={value.name} placeholder="例如：婉拒他人请求" onChange={name => patch({ name })}/>
        <Field label="中文用法说明" value={value.explanation} multiline placeholder="说明这个词适用的具体语境" onChange={explanation => patch({ explanation })}/>
        <ExampleListEditor label="例句" examples={value.examples} onChange={examples => patch({ examples })}/>
        <details className="usage-more-options">
          <summary>使用提示{tipFilled && <span className="usage-filled-indicator">已填写</span>}</summary>
          <div className="usage-optional-fields"><AutoTextarea aria-label="使用提示（选填）" value={value.tip} maxLength={3000} onChange={tip => patch({ tip })}/></div>
        </details>
      </>;
    }
    case 'grammar': {
      const value = usage.grammar!;
      const patch = (change: FieldUpdate<typeof value>) => onChange(current => ({ ...current, grammar: applyUpdates(current.grammar!, change) }));
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
      const patch = (change: FieldUpdate<typeof value>) => onChange(current => ({ ...current, comparison: applyUpdates(current.comparison!, change) }));
      return <>
        <Field label="比较情境" value={value.context} multiline placeholder="说明比较发生的语境" onChange={context => patch({ context })}/>
        <Field label="核心区别" value={value.difference} multiline placeholder="简洁概括这些表达的关键区别" onChange={difference => patch({ difference })}/>
        <ExpressionListEditor expressions={value.expressions} onChange={expressions => patch({ expressions })} openIds={openExpressionIds} setOpenIds={setOpenExpressionIds}/>
        <details className="usage-more-options">
          <summary>补充说明{value.note.trim() && <span className="usage-filled-indicator">已填写</span>}</summary>
          <div className="usage-optional-fields"><AutoTextarea aria-label="补充说明（选填）" value={value.note} maxLength={3000} onChange={note => patch({ note })}/></div>
        </details>
      </>;
    }
    case 'error': {
      const value = usage.error!;
      const patch = (change: FieldUpdate<typeof value>) => onChange(current => ({ ...current, error: applyUpdates(current.error!, change) }));
      const optionalFilled = !!value.note.trim();
      return <>
        <Field label="问题名称" value={value.name} placeholder="例如：介词搭配" onChange={name => patch({ name })}/>
        <label className="usage-field">表达问题性质<select value={value.severity} onChange={event => patch({ severity: event.target.value as typeof value.severity })}>
          <option value="incorrect">真正的错误</option><option value="unnatural">表达不够自然</option>
        </select></label>
        <div className="usage-error-pair">
          <Field label={value.severity === 'incorrect' ? '错误表达' : '不自然的表达'} value={value.incorrect} multiline placeholder="输入需要修正的表达" onChange={incorrect => patch({ incorrect })}/>
          <Field label={value.severity === 'incorrect' ? '正确表达' : '更自然的表达'} value={value.correct} multiline placeholder="输入正确、自然的表达" onChange={correct => patch({ correct })}/>
        </div>
        <Field label={value.severity === 'incorrect' ? '错误原因' : '改进原因'} value={value.reason} multiline placeholder="说明问题原因" onChange={reason => patch({ reason })}/>
        <ExampleListEditor label="修正例句" examples={value.examples} onChange={examples => patch({ examples })}/>
        <details className="usage-more-options">
          <summary>补充说明{optionalFilled && <span className="usage-filled-indicator">已填写</span>}</summary>
          <div className="usage-optional-fields"><AutoTextarea aria-label="补充说明（选填）" value={value.note} maxLength={3000} onChange={note => patch({ note })}/></div>
        </details>
      </>;
    }
    default: return null;
  }
}

export function UsageEditor({ entries, onChange, invalidEntryId = '', error = '' }: { entries: LearningEntry[]; onChange: (entries: ValueUpdate<LearningEntry[]>) => void; invalidEntryId?: string; error?: string }) {
  const recordEditorUndo = useEditorUndo();
  const editorRef = useRef<HTMLDivElement>(null);
  const [allDetailsOpen, setAllDetailsOpen] = useState(false);
  const [detailsRevision, setDetailsRevision] = useState(0);
  const [openCategories, setOpenCategories] = useState<Set<UsageKind>>(() => new Set());
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());
  const [openExpressions, setOpenExpressions] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!invalidEntryId) return;
    const entry = entries.find(item => item.id === invalidEntryId);
    const usage = entry && structuredUsage(entry);
    if (!usage?.kind) return;
    setOpenCategories(previous => new Set(previous).add(usage.kind!));
    setOpenItems(previous => new Set(previous).add(invalidEntryId));
    setOpenExpressions(previous => new Set([...previous, ...(usage.comparison?.expressions.map(item => item.id) || [])]));
  }, [invalidEntryId, error]);
  useEffect(() => {
    editorRef.current?.querySelectorAll('details').forEach(details => { details.open = allDetailsOpen; });
  }, [detailsRevision]);
  const update = (id: string, usage: ValueUpdate<StructuredUsage>) => onChange(current => current.map(entry => {
    if (entry.id !== id) return entry;
    const currentUsage = structuredUsage(entry);
    return usageEntry(id, typeof usage === 'function' ? usage(currentUsage) : usage);
  }));
  const groups = new Map(usageKinds.map(kind => [kind, entries.filter(entry => structuredUsage(entry).kind === kind)]));
  const addItem = (kind: UsageKind) => {
    const id = crypto.randomUUID();
    onChange(current => [...current, usageEntry(id, emptyUsage(kind))]);
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
  const allExpanded = allDetailsOpen && openCategories.size === usageKinds.length && entries.every(entry => openItems.has(entry.id))
    && entries.every(entry => structuredUsage(entry).comparison?.expressions.every(expression => openExpressions.has(expression.id)) ?? true);
  const expandAll = () => {
    setAllDetailsOpen(true); setDetailsRevision(previous => previous + 1);
    setOpenCategories(new Set(usageKinds));
    setOpenItems(new Set(entries.map(entry => entry.id)));
    setOpenExpressions(new Set(entries.flatMap(entry => structuredUsage(entry).comparison?.expressions.map(expression => expression.id) || [])));
  };
  const collapseAll = () => {
    setAllDetailsOpen(false); setDetailsRevision(previous => previous + 1);
    setOpenCategories(new Set());
    setOpenItems(new Set());
    setOpenExpressions(new Set());
  };
  const renderItem = (entry: LearningEntry, index: number, group: LearningEntry[], kind: UsageKind | undefined) => {
    const usage = structuredUsage(entry);
    const title = usageTitle(usage);
    const summary = usageSummary(usage);
    const open = openItems.has(entry.id);
    const globalIndex = entries.findIndex(item => item.id === entry.id);
    const label = `${kind ? USAGE_HEADINGS[kind] : '用法要点'} ${index + 1}`;
    return <article key={entry.id} data-editor-entry={entry.id} className="usage-item-editor">
      <div className="usage-item-editor__heading">
        <button type="button" className="usage-item-toggle" aria-expanded={open} aria-label={`${open ? '收起' : '展开'}${label}`} onClick={() => toggleItem(entry.id)}>
          <span className="usage-item-copy"><strong>{title}</strong>{summary && <span>{summary}</span>}<small>{usageCounts(usage)}</small></span>
          <ChevronDown className="usage-disclosure-chevron" size={18} aria-hidden="true"/>
        </button>
        <div className="usage-item-controls">
          <EditorOrderActions className="usage-order-actions" label={label} first={index === 0} last={index === group.length - 1}
            onRemove={() => {
              onChange(current => current.filter(item => item.id !== entry.id));
              setOpenItems(previous => { const next = new Set(previous); next.delete(entry.id); return next; });
              recordEditorUndo(() => {
                onChange(current => current.some(item => item.id === entry.id) ? current : [...current.slice(0, Math.min(globalIndex, current.length)), entry, ...current.slice(Math.min(globalIndex, current.length))]);
                setOpenItems(previous => new Set(previous).add(entry.id));
              }, '用法要点已删除');
            }}
            onMove={direction => {
              const other = group[index + direction];
              if (!other) return;
              onChange(current => {
                const next = [...current];
                const a = next.findIndex(item => item.id === entry.id), b = next.findIndex(item => item.id === other.id);
                if (a >= 0 && b >= 0) [next[a], next[b]] = [next[b], next[a]];
                return next;
              });
            }}/>
        </div>
      </div>
      {open && <div className="usage-item-editor__content">
        {entry.id === invalidEntryId && error && <p className="editor-field-error" role="alert">{error}</p>}
        <CategoryFields usage={usage} onChange={next => update(entry.id, next)} openExpressionIds={openExpressions} setOpenExpressionIds={setOpenExpressions}/>
      </div>}
    </article>;
  };
  return <div ref={editorRef} className="usage-editor" onToggleCapture={() => {
    const details = Array.from<HTMLDetailsElement>(editorRef.current?.querySelectorAll('details') || []);
    setAllDetailsOpen(details.every(item => item.open));
  }}>
    <div className="usage-editor-toolbar">
      <span className="usage-editor-total">{entries.length} 个用法要点</span>
      <div><button type="button" className="lexicon-link" disabled={!entries.length || allExpanded} onClick={expandAll}>展开所有内容</button>
        <button type="button" className="lexicon-link" disabled={!entries.length || (!openCategories.size && !openItems.size)} onClick={collapseAll}>收起所有内容</button></div>
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
  </div>;
}
