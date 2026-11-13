import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { USAGE_HEADINGS, type LearningEntry, type StructuredUsage, type UsageExample, type UsageKind } from '../types';
import { compatibilityHasContent, emptyUsage, emptyUsageCategory, structuredUsage, usageEntry, usageKinds } from '../utils/structuredUsage';

type FieldProps = { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; optional?: boolean };
function Field({ label, value, onChange, multiline = false, optional = false }: FieldProps) {
  return <label className={multiline ? 'usage-field usage-field--wide' : 'usage-field'}>
    <span>{label}{optional ? '（选填）' : ''}</span>
    {multiline ? <textarea rows={3} value={value} maxLength={3000} onChange={event => onChange(event.target.value)}/>
      : <input value={value} maxLength={3000} onChange={event => onChange(event.target.value)}/>}
  </label>;
}
function OrderActions({ label, first, last, onMove, onRemove }: {
  label: string; first: boolean; last: boolean; onMove: (direction: number) => void; onRemove: () => void;
}) {
  return <div className="usage-order-actions">
    <button type="button" aria-label={`上移${label}`} disabled={first} onClick={() => onMove(-1)}><ArrowUp size={16}/></button>
    <button type="button" aria-label={`下移${label}`} disabled={last} onClick={() => onMove(1)}><ArrowDown size={16}/></button>
    <button type="button" aria-label={`删除${label}`} onClick={onRemove}><Trash2 size={16}/></button>
  </div>;
}
function move<T>(items: T[], index: number, direction: number): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function UsageExamplesEditor({ examples, onChange, label = '例句' }: {
  examples: UsageExample[]; onChange: (examples: UsageExample[]) => void; label?: string;
}) {
  return <div className="usage-examples-editor">
    {examples.map((example, index) => <fieldset key={example.id} className="usage-example-editor">
      <legend>{label} {index + 1}</legend>
      <OrderActions label={`${label} ${index + 1}`} first={index === 0} last={index === examples.length - 1}
        onMove={direction => onChange(move(examples, index, direction))}
        onRemove={() => onChange(examples.filter((_, i) => i !== index))}/>
      <Field label="英文例句" value={example.english} multiline onChange={english => onChange(examples.map((item, i) => i === index ? { ...item, english } : item))}/>
      <Field label="中文译文" value={example.chinese} multiline onChange={chinese => onChange(examples.map((item, i) => i === index ? { ...item, chinese } : item))}/>
    </fieldset>)}
    <button type="button" className="lexicon-link usage-add" onClick={() => onChange([...examples, { id: crypto.randomUUID(), english: '', chinese: '' }])}><Plus size={16}/>添加{label}与译文</button>
  </div>;
}
function CategoryFields({ usage, onChange }: { usage: StructuredUsage; onChange: (usage: StructuredUsage) => void }) {
  switch (usage.kind) {
    case 'scenario': {
      const value = usage.scenario!;
      const patch = (change: Partial<typeof value>) => onChange({ ...usage, scenario: { ...value, ...change } });
      return <>
        <Field label="场景名称" value={value.name} onChange={name => patch({ name })}/>
        <Field label="中文用法说明" value={value.explanation} multiline onChange={explanation => patch({ explanation })}/>
        <UsageExamplesEditor examples={value.examples} onChange={examples => patch({ examples })}/>
      </>;
    }
    case 'grammar': {
      const value = usage.grammar!;
      const patch = (change: Partial<typeof value>) => onChange({ ...usage, grammar: { ...value, ...change } });
      return <>
        <Field label="搭配规则名称" value={value.name} onChange={name => patch({ name })}/>
        <Field label="中文规则说明" value={value.explanation} multiline onChange={explanation => patch({ explanation })}/>
        <Field label="正确搭配" value={value.correct} multiline optional onChange={correct => patch({ correct })}/>
        <UsageExamplesEditor examples={value.examples} onChange={examples => patch({ examples })}/>
        <details className="usage-more-options">
          <summary>更多选项</summary>
          <Field label="常见错误或限制" value={value.restriction} multiline optional onChange={restriction => patch({ restriction })}/>
          <Field label="补充说明" value={value.note} multiline optional onChange={note => patch({ note })}/>
        </details>
      </>;
    }
    case 'comparison': {
      const value = usage.comparison!;
      const patch = (change: Partial<typeof value>) => onChange({ ...usage, comparison: { ...value, ...change } });
      return <>
        <Field label="比较情境" value={value.context} multiline onChange={context => patch({ context })}/>
        <Field label="核心区别" value={value.difference} multiline onChange={difference => patch({ difference })}/>
        <div className="usage-expression-editors">
          {value.expressions.map((expression, index) => {
            const patchExpression = (change: Partial<typeof expression>) => patch({ expressions: value.expressions.map((item, i) => i === index ? { ...item, ...change } : item) });
            return <fieldset key={expression.id} className="usage-expression-editor">
              <legend>对比表达 {index + 1}</legend>
              <OrderActions label={`对比表达 ${index + 1}`} first={index === 0} last={index === value.expressions.length - 1}
                onMove={direction => patch({ expressions: move(value.expressions, index, direction) })}
                onRemove={() => patch({ expressions: value.expressions.filter((_, i) => i !== index) })}/>
              <Field label="单词或词组" value={expression.expression} onChange={expression => patchExpression({ expression })}/>
              <Field label="中文语义说明" value={expression.explanation} multiline onChange={explanation => patchExpression({ explanation })}/>
              <UsageExamplesEditor examples={expression.examples} onChange={examples => patchExpression({ examples })}/>
            </fieldset>;
          })}
          <button type="button" className="lexicon-link usage-add" onClick={() => patch({ expressions: [...value.expressions, { id: crypto.randomUUID(), expression: '', explanation: '', examples: [] }] })}><Plus size={16}/>添加对比表达</button>
        </div>
        <Field label="补充说明" value={value.note} multiline optional onChange={note => patch({ note })}/>
      </>;
    }
    case 'error': {
      const value = usage.error!;
      const patch = (change: Partial<typeof value>) => onChange({ ...usage, error: { ...value, ...change } });
      return <>
        <Field label="错误类型" value={value.name} onChange={name => patch({ name })}/>
        <label className="usage-field">表达问题性质<select value={value.severity} onChange={event => patch({ severity: event.target.value as typeof value.severity })}>
          <option value="incorrect">真正的错误</option><option value="unnatural">表达不够自然</option>
        </select></label>
        <Field label={value.severity === 'incorrect' ? '错误表达' : '不自然的表达'} value={value.incorrect} multiline onChange={incorrect => patch({ incorrect })}/>
        <Field label="正确表达" value={value.correct} multiline onChange={correct => patch({ correct })}/>
        <Field label={value.severity === 'incorrect' ? '错误原因' : '改进原因'} value={value.reason} multiline onChange={reason => patch({ reason })}/>
        <UsageExamplesEditor label="修正例句" examples={value.examples} onChange={examples => patch({ examples })}/>
        <Field label="补充说明" value={value.note} multiline optional onChange={note => patch({ note })}/>
      </>;
    }
    default: return null;
  }
}
export function UsageEditor({ entries, onChange }: { entries: LearningEntry[]; onChange: (entries: LearningEntry[]) => void }) {
  const update = (id: string, usage: StructuredUsage) => onChange(entries.map(entry => entry.id === id ? usageEntry(id, usage) : entry));
  const groups: (UsageKind | undefined)[] = [...usageKinds, undefined];
  return <div className="usage-editor">
    {groups.map(kind => {
      const group = entries.filter(entry => structuredUsage(entry).kind === kind);
      if (!group.length) return null;
      const items = group.map((entry, index) => {
        const usage = structuredUsage(entry);
        const old = usage.compatibility;
        const label = `${kind ? USAGE_HEADINGS[kind] : '历史内容'} ${index + 1}`;
        const inactive = usageKinds.filter(key => key !== usage.kind && usage[key]);
        return <fieldset key={entry.id} className="usage-item-editor">
          <legend>{label}</legend>
          <OrderActions label={label} first={index === 0} last={index === group.length - 1}
            onRemove={() => onChange(entries.filter(item => item.id !== entry.id))}
            onMove={direction => {
              const other = group[index + direction];
              if (!other) return;
              const next = [...entries];
              const a = next.findIndex(item => item.id === entry.id), b = next.findIndex(item => item.id === other.id);
              [next[a], next[b]] = [next[b], next[a]];
              onChange(next);
            }}/>
          <label className="usage-field">用法类别<select value={usage.kind || ''} onChange={event => {
            const next = event.target.value as UsageKind;
            update(entry.id, { ...usage, kind: next, [next]: usage[next] || emptyUsageCategory(next) });
          }}><option value="" disabled>请选择用法类别</option>{usageKinds.map(key => <option key={key} value={key}>{USAGE_HEADINGS[key]}</option>)}</select></label>
          {inactive.length > 0 && <p className="lexicon-muted usage-retained" role="status">已保留{inactive.map(key => `「${USAGE_HEADINGS[key]}」`).join('、')}的填写内容，可切换回原类别继续编辑。</p>}
          <CategoryFields usage={usage} onChange={next => update(entry.id, next)}/>
          {old && compatibilityHasContent(usage) && <details className="usage-compatibility-editor" open={!usage.kind}>
            <summary>保留的历史内容</summary>
            <Field label="历史标题或表达" value={old.title} onChange={title => update(entry.id, { ...usage, compatibility: { ...old, title } })}/>
            <Field label="历史说明" value={old.explanation} multiline onChange={explanation => update(entry.id, { ...usage, compatibility: { ...old, explanation } })}/>
            <Field label="历史补充说明" value={old.note} multiline optional onChange={note => update(entry.id, { ...usage, compatibility: { ...old, note } })}/>
            <UsageExamplesEditor examples={old.examples} onChange={examples => update(entry.id, { ...usage, compatibility: { ...old, examples } })}/>
          </details>}
        </fieldset>;
      });
      return <section key={kind || 'compatibility'} className="usage-editor-group">
        {kind ? <details className="usage-category-disclosure-editor" open>
          <summary><h4>{USAGE_HEADINGS[kind]}</h4><span className="usage-disclosure-triangle" aria-hidden="true"/></summary>
          <div className="usage-category-disclosure-editor__content">{items}</div>
        </details> : <><h4>{kind ? USAGE_HEADINGS[kind] : '保留的历史内容'}</h4>{items}</>}
      </section>;
    })}
    <div className="usage-add-actions">{usageKinds.map(kind => <button key={kind} type="button" className="lexicon-link usage-add"
      onClick={() => onChange([...entries, usageEntry(crypto.randomUUID(), emptyUsage(kind))])}><Plus size={16}/>添加{USAGE_HEADINGS[kind]}</button>)}</div>
  </div>;
}
