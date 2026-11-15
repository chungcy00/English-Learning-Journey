import { LoadingAnimation } from './LoadingAnimation';
import { StudyEmptyState } from './LearningArt';
import React, { useEffect, useRef, useState } from 'react';
import { EntryExample, PhraseList } from './PhraseUsage';
import { UsageList } from './UsageAnalysis';
import { UsageEditor } from './UsageEditor';
import { AutoTextarea } from './AutoTextarea';
import { EditorOrderActions, EditorUndoNotice, moveEditorItems, recordEditorUndo } from './EditorControls';
import { structuredUsage, upgradeUsageDetails, usageEntry, usageValidationError } from '../utils/structuredUsage';
import { DerivativeList, RootAnalysisList, WordFormationEditor, DerivativeFamilyEditor } from './WordFormation';
import { ExampleSenseCards } from './ExampleSenseCards';
import { DefinitionCards } from './DefinitionCards';
import { partOfSpeechAbbreviation } from '../utils/wordFormation';
import { ChevronDown, Pencil, Plus, Trash2, Volume2 } from 'lucide-react';
import { DETAIL_SECTIONS, type DetailSection, type LearningEntry, type VocabularyDetails, type VocabularyItem } from '../types';
import { legacyDetails, sectionLabels, materialKey, categoryLabels, inflectionLabel, orderedInflections, vocabularyKey } from '../utils/vocabularyDetails';
import { readVocabularyDetails, saveVocabularyDetails, generateVocabularyDetails, toggleMaterial } from '../services/vocabularyDetails';
import { db } from '../db/dexie';
import { speakEnglishTerm } from '../utils/speech';

type EditorSection = DetailSection | 'basic';
type EditField = [keyof LearningEntry, label: string, placeholder: string, multiline?: boolean];

const chinese: EditField = ['meaningZh', '中文释义', '例如：体贴的；考虑周到的'];
const posField: EditField = ['partOfSpeech', '词性（选填）', '例如 adj. 或形容词'];
const example: EditField = ['example', '英文例句', '例如 That was considerate of you.', true];
const translation: EditField = ['exampleTranslation', '中文译文', '例如：你想得真周到。', true];
const note: EditField = ['note', '补充说明（选填）', '需要时补充简短说明', true];
const editorLabels: Record<EditorSection, string> = {
  basic: '释义', examples: '例句', roots: '构词分析', derivatives: '派生词',
  phrases: '词组', definitions: '英文释义', usage: '用法要点',
};

function editorFields(section: EditorSection, entry: LearningEntry): { main: EditField[]; extra?: EditField[] } {
  switch (section) {
    case 'basic': return { main: [posField, chinese], extra: [example, translation, ...(!entry.meaningZh && entry.text ? [['text', '原有释义', '可填写中文释义'] as EditField] : [])] };
    case 'examples': return entry.example ? {
      main: [['text', '关联表达', '例如 deeply rooted'], ['meaningZh', '表达的中文意思', '例如：根深蒂固的'], ['example', '英文例句', '输入一个完整句子', true], translation],
      extra: [note],
    } : {
      main: [['text', '英文例句', '输入一个完整句子', true], ['meaningZh', '中文译文', '输入整句的中文翻译', true]], extra: [note],
    };
    case 'roots': return { main: [] };
    case 'derivatives': return { main: [['text', '英文派生词', '例如 considerately'], posField, chinese, example, translation], extra: [note] };
    case 'phrases': return { main: [['text', '完整英文词组', '例如 considerate of others'], ['meaningZh', '词组的中文意思', '例如：为他人着想'], example, translation], extra: [note] };
    case 'definitions': return { main: [['text', '英文定义', '用简短、自然的英文解释一个词义', true]] };
    case 'usage': return { main: [] };
  }
}

function entryHeading(section: EditorSection, entry: LearningEntry, index: number) {
  if (section === 'examples') return {
    title: entry.text.trim() || entry.example?.trim() || `例句 ${index + 1}`,
    summary: entry.meaningZh || entry.exampleTranslation || '',
  };
  if (section === 'roots') return { title: '', summary: '' };
  if (section === 'derivatives') return { title: entry.text.trim() || `派生词 ${index + 1}`, summary: entry.meaningZh || entry.partOfSpeech || '' };
  if (section === 'phrases') return { title: entry.text.trim() || `词组 ${index + 1}`, summary: entry.meaningZh || entry.note || '' };
  return { title: entry.text.trim() || `英文释义 ${index + 1}`, summary: '' };
}

export function VocabularyDetailsPanel({ vocab, onBeforePronunciation, onInteractionStateChange, loadingOperation = 'vocabulary' }: { key?: string; loadingOperation?: 'vocabulary' | 'analysis'; vocab: VocabularyItem; onBeforePronunciation?: () => void; onInteractionStateChange?: (busy: boolean) => void }) {
  const [details, setDetails] = useState<VocabularyDetails>(() => legacyDetails(vocab));
  const [tab, setTab] = useState<DetailSection>('examples');
  const [draft, setDraft] = useState<VocabularyDetails | null>(null);
  const [editing, setEditing] = useState<DetailSection | 'basic' | null>(null);
  const [openEditorEntries, setOpenEditorEntries] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmUsageReplacement, setConfirmUsageReplacement] = useState(false);
  const editBaseline = useRef('');
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const lock = useRef(false);
  const run = useRef(0);
  useEffect(() => { onInteractionStateChange?.(!!editing); }, [busy, editing, onInteractionStateChange]);
  useEffect(() => () => onInteractionStateChange?.(false), [onInteractionStateChange]);
  useEffect(() => {
    const id = ++run.current;
    setConfirmUsageReplacement(false); setDetails(legacyDetails(vocab)); setDraft(null); setEditing(null); setError(''); setMessage(''); setReady(false); setTab('examples');
    readVocabularyDetails(vocab).then(value => { if (run.current === id) { setDetails(value); setReady(true); if (!value.generated) generate(); } }).catch(() => { if (run.current === id) setError('本地资料读取失败，请关闭后重试。'); });
    return () => { run.current++; };
  }, [vocab.id, vocab.term]);
  useEffect(() => {
    let active = true;
    const refresh = () => { void db.vocabularyDetails.get(vocabularyKey(vocab.term,vocab.type)).then(value=>{if(active&&value)setDetails(upgradeUsageDetails(value));}).catch(()=>{if(active)setError('本地用法资料更新读取失败，请稍后重试。');}); return void db.savedMaterials.toArray().then(items => { if (active) setSavedKeys(new Set(items.map(item => item.key))); }).catch(() => { if (active) setError('收藏读取失败，请稍后重试。'); }); };
    refresh(); window.addEventListener('vocabulary-data-changed', refresh);
    return () => { active = false; window.removeEventListener('vocabulary-data-changed', refresh); };
  }, [vocab.id,vocab.term]);
  const perform = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    const id = run.current;
    try { await work(); } catch (error) { if (id === run.current) setError(error instanceof Error ? error.message : '操作失败，原资料已保留，请重试。'); }
    finally { lock.current = false; if (id === run.current) setBusy(false); }
  };
  const generate = (section?: DetailSection, replaceEdited = false) => void perform(async () => {
    const id = run.current;
    const value = await generateVocabularyDetails(vocab, section, replaceEdited);
    setConfirmUsageReplacement(false);
    if (id === run.current) setDetails(value);
  });
  const startEdit = (section: DetailSection | 'basic') => { const copy = structuredClone(upgradeUsageDetails(details)); editBaseline.current = JSON.stringify(section === 'basic' ? copy.senses : copy.sections[section]); setOpenEditorEntries(new Set()); setConfirmUsageReplacement(false); copy.inflections = copy.inflections.map(form => ({ ...form, label: inflectionLabel(form.label) })); setDraft(copy); setEditing(section); setError(''); setMessage(''); };
  const save = () => void perform(async () => {
    if (!draft || !editing) return;
    const now = Date.now();
    const latest = await readVocabularyDetails(vocab);
    if (editing === 'usage' && JSON.stringify(latest.sections.usage) !== editBaseline.current) {
      throw new Error('本栏资料已在其他窗口更新。当前填写内容已保留，请取消后重新打开，核对最新资料再编辑。');
    }
    if (editing === 'usage') {
      for (const entry of draft.sections.usage) {
        const problem = usageValidationError(structuredUsage(entry));
        if (problem) throw new Error(problem);
      }
    }
    if (editing !== 'basic' && editing !== 'usage' && editing !== 'roots') {
      for (const item of draft.sections[editing]) {
        const hasContent = [item.text, item.meaningZh, item.example, item.exampleTranslation, item.note].some(value => value?.trim());
        if (hasContent && !item.text.trim()) throw new Error('请填写英文内容后保存，或删除不需要的空项目。');
        if (editing === 'definitions' && item.text.trim() && (!/[a-z]/i.test(item.text) || /[\u3400-\u9fff]/.test(item.text))) {
          throw new Error('英文释义请填写纯英文内容。当前修改已保留。');
        }
      }
    }
    const editedEntries = editing === 'basic' ? [] : draft.sections[editing].map(item => {
      if (editing === 'usage') return usageEntry(item.id, structuredUsage(item));
      if (editing === 'roots' && item.morphology) {
        const legacy = item.morphology as typeof item.morphology & { root?: string; meaningZh?: string };
        const { root: oldRoot, meaningZh: oldMeaning, ...morphology } = legacy;
        const parts = morphology.parts.map(part => ({ ...part }));
        const rootIndex = parts.findIndex(part => part.kind === 'root');
        if (rootIndex < 0 && oldRoot?.trim()) {
          const suffixIndex = parts.findIndex(part => part.kind === 'suffix');
          const insertAt = suffixIndex < 0 ? parts.length : suffixIndex;
          parts.splice(insertAt, 0, { kind: 'root', text: oldRoot.trim(), meaningZh: oldMeaning?.trim() || '' });
        } else if (rootIndex >= 0 && (!parts[rootIndex].text.trim() || parts[rootIndex].text.trim() === oldRoot?.trim())) {
          parts[rootIndex] = { ...parts[rootIndex], text: parts[rootIndex].text.trim() || oldRoot?.trim() || '', meaningZh: parts[rootIndex].meaningZh.trim() || oldMeaning?.trim() || '' };
        }
        return { ...item, text: '', meaningZh: '', morphology: { ...morphology, parts } };
      }
      if (editing === 'examples' && !item.text.trim() && item.example?.trim()) return { ...item, text: item.example };

      return item;
    }).filter(item => editing === 'usage' || (editing === 'roots'
      ? !!(item.morphology?.parts.some(part => part.text.trim() || part.meaningZh.trim()) || item.morphology?.explanation.trim() || item.morphology?.mnemonic.trim() || item.morphology?.related.length)
      : item.text.trim()));
    const next: VocabularyDetails = { ...latest, ...(editing === 'basic' ? { phoneticUK: draft.phoneticUK.trim(), phoneticUS: draft.phoneticUS.trim(), senses: draft.senses.filter(item => item.text.trim() || item.meaningZh.trim()), inflections: (details.category || details.type) === 'word' ? draft.inflections.filter(item => item.label.trim() && item.value.trim()) : [] } : {}),
      sections: { ...latest.sections, ...(editing !== 'basic' ? { [editing]: editedEntries } : {}) },
      provenance: { ...latest.provenance, [editing]: { source: 'user' as const, updatedAt: now } }, updatedAt: now };
    await saveVocabularyDetails(next, editing === 'usage' ? latest.sections.usage : undefined); setDetails(next); setDraft(null); setEditing(null); setMessage('修改已保存。');
  });
  const pronounce = (text: string, accent?: 'en-GB' | 'en-US') => { setError(''); onBeforePronunciation?.(); speakEnglishTerm(text, setError, accent); };
  const items = details.sections[tab];
  const category = details.category || (details.type === 'word' || details.type === 'idiom' ? details.type : undefined);
  const patchEntry = (index: number, field: keyof LearningEntry, value: string | LearningEntry['family'] | LearningEntry['morphology'] | LearningEntry['contrast']) => {
    if (!draft || !editing) return;
    const list = editing === 'basic' ? draft.senses : draft.sections[editing];
    const next = list.map((item, i) => i === index ? { ...item, [field]: value } : item);
    setDraft(editing === 'basic' ? { ...draft, senses: next } : { ...draft, sections: { ...draft.sections, [editing]: next } });
  };
  const setEditorEntries = (section: DetailSection | 'basic', update: LearningEntry[] | ((entries: LearningEntry[]) => LearningEntry[])) => {
    setDraft(current => {
      if (!current) return current;
      const entries = section === 'basic' ? current.senses : current.sections[section];
      const nextEntries = typeof update === 'function' ? update(entries) : update;
      return section === 'basic' ? { ...current, senses: nextEntries } : { ...current, sections: { ...current.sections, [section]: nextEntries } };
    });
  };
  const editorEntries = (entries: LearningEntry[], section: EditorSection) => entries.map((entry, index) => {
    const fields = editorFields(section, entry);
    const heading = entryHeading(section, entry, index);
    const canFold = entries.length > 1 && (section === 'examples' || section === 'derivatives' || section === 'phrases');
    const open = section === 'basic' || !canFold || openEditorEntries.has(entry.id);
    const optionalFilled = !!fields.extra?.some(([field]) => {
      const value = entry[field];
      return typeof value === 'string' && value.trim();
    }) || (editing === 'examples' && !!(entry.senseMeaningZh?.trim() || entry.partOfSpeech?.trim()));
    const renderField = ([field, label, placeholder, multiline]: EditField) => {
      const value = entry[field];
      const stringValue = typeof value === 'string' ? value : '';
      return <label key={field} className={multiline ? 'lexicon-editor-wide' : undefined}>{label}
        {multiline ? <AutoTextarea maxLength={3000} value={stringValue} onChange={next => patchEntry(index, field, next)} placeholder={placeholder}/> : <input maxLength={3000} value={stringValue} onChange={event => patchEntry(index, field, event.target.value)} placeholder={placeholder}/>}
      </label>;
    };
    const content = <>
    {editing === 'examples' && !!draft?.senses.length && <label>关联已有词义（选填）<select value={entry.senseId || ''} onChange={event=>patchEntry(index,'senseId',event.target.value)}><option value="">不关联已有词义</option>{draft.senses.map(sense=><option key={sense.id} value={sense.id}>{partOfSpeechAbbreviation(sense.partOfSpeech)} {sense.meaningZh || sense.text}</option>)}</select></label>}
    {editing === 'examples' && <details className="lexicon-editor-optional"><summary>词义设置（选填）{optionalFilled && <span className="usage-filled-indicator">已填写</span>}</summary><div className="lexicon-editor-fields">{renderField(['senseMeaningZh','本组词义','例如：根深蒂固的'])}{renderField(posField)}</div></details>}
    {!!fields.main.length && <div className="lexicon-editor-fields">{fields.main.map(renderField)}</div>}
    {!!fields.extra?.length && <details className="lexicon-editor-optional"><summary>补充资料（选填）{optionalFilled && <span className="usage-filled-indicator">已填写</span>}</summary><div className="lexicon-editor-fields">{fields.extra.map(renderField)}</div></details>}
    {editing === 'derivatives' && <DerivativeFamilyEditor entry={entry} onChange={family => patchEntry(index, 'family', family)}/>}
    {editing === 'roots' && <WordFormationEditor entry={entry} onChange={next => patchEntry(index, 'morphology', next.morphology)}/>}
    </>;
    if (section === 'basic') return <fieldset key={entry.id} className="lexicon-editor-entry"><legend><span>{editorLabels[section]} {index + 1}</span><button type="button" className="lexicon-editor-remove" aria-label={`删除${editorLabels[section]} ${index + 1}`} onClick={() => {
      setEditorEntries(section, current => current.filter(item => item.id !== entry.id));
      recordEditorUndo(() => setEditorEntries(section, current => current.some(item => item.id === entry.id) ? current : [...current.slice(0, Math.min(index, current.length)), entry, ...current.slice(Math.min(index, current.length))]));
    }}><Trash2 size={16}/></button></legend>{content}</fieldset>;
    const label = `${editorLabels[section]} ${index + 1}`;
    const removeEntry = () => {
      setEditorEntries(section, current => current.filter(item => item.id !== entry.id));
      recordEditorUndo(() => setEditorEntries(section, current => current.some(item => item.id === entry.id) ? current : [...current.slice(0, Math.min(index, current.length)), entry, ...current.slice(Math.min(index, current.length))]));
    };
    if (section === 'roots') return <article key={entry.id} className="lexicon-root-editor-entry">
      {entries.length > 1 && <EditorOrderActions className="lexicon-root-editor-entry__actions" label={label} first={index === 0} last={index === entries.length - 1} onMove={direction => setEditorEntries(section, moveEditorItems(entries, index, direction))} onRemove={removeEntry}/>}
      {entries.length === 1 && <button type="button" className="lexicon-root-editor-entry__remove" aria-label={`删除${label}`} onClick={removeEntry}><Trash2 size={16}/></button>}
      <div className="lexicon-editor-item__content">{content}</div>
    </article>;
    if (section === 'definitions') return <article key={entry.id} className="lexicon-definition-editor-entry">
      <div className="lexicon-editor-fields">{content}</div>
      <EditorOrderActions label={label} first={index === 0} last={index === entries.length - 1} onMove={direction => setEditorEntries(section, moveEditorItems(entries, index, direction))} onRemove={removeEntry}/>
    </article>;
    if (!canFold) return <article key={entry.id} className="lexicon-editor-direct-entry">
      <div className="lexicon-editor-item__heading"><strong>{heading.title || `${editorLabels[section]} ${index + 1}`}{heading.summary && <span>{heading.summary}</span>}</strong>
        <EditorOrderActions label={label} first={index === 0} last={index === entries.length - 1} onMove={direction => setEditorEntries(section, moveEditorItems(entries, index, direction))} onRemove={removeEntry}/>
      </div>
      <div className="lexicon-editor-item__content">{content}</div>
    </article>;
    return <article key={entry.id} className="lexicon-editor-item">
      <div className="lexicon-editor-item__heading">
        <button type="button" className="lexicon-editor-item__toggle" aria-expanded={open} onClick={() => setOpenEditorEntries(previous => { const next = new Set(previous); if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id); return next; })}>
          <span className="lexicon-editor-item__copy"><strong>{heading.title}</strong>{heading.summary && <span>{heading.summary}</span>}</span>
          <ChevronDown className="usage-disclosure-chevron lexicon-editor-item__chevron" size={18} aria-hidden="true"/>
        </button>
        <div className="lexicon-editor-item__controls">
          <EditorOrderActions label={label} first={index === 0} last={index === entries.length - 1} onMove={direction => setEditorEntries(section, moveEditorItems(entries, index, direction))} onRemove={() => {
            const wasOpen = openEditorEntries.has(entry.id);
            setOpenEditorEntries(previous => { const next = new Set(previous); next.delete(entry.id); return next; });
            setEditorEntries(section, current => current.filter(item => item.id !== entry.id));
            recordEditorUndo(() => {
              setEditorEntries(section, current => current.some(item => item.id === entry.id) ? current : [...current.slice(0, Math.min(index, current.length)), entry, ...current.slice(Math.min(index, current.length))]);
              if (wasOpen) setOpenEditorEntries(previous => new Set(previous).add(entry.id));
            });
          }}/>
        </div>
      </div>
      {open && <div className="lexicon-editor-item__content">{content}</div>}
    </article>;
  });
  return <div className="lexicon-panel" aria-busy={busy}>
    <div className="lexicon-basic">
      <p className="lexicon-kind">{category ? `${categoryLabels[category]} · ${category === 'phrasal-verb' ? 'phrasal verb' : category}` : details.generated ? `${categoryLabels[details.type] || '词条'} · ${details.type}` : '多词表达 · 生成时自动细分类型'}</p>
      <div className="lexicon-pronunciations">{([['en-GB', '英', details.phoneticUK], ['en-US', '美', details.phoneticUS]] as const).map(([lang, label, ipa]) => <button key={lang} type="button" onClick={() => pronounce(vocab.term, lang)} aria-label={`${label}式发音：${vocab.term}`}><Volume2 size={17} aria-hidden="true"/>{label}{ipa && <span>{ipa}</span>}</button>)}<button type="button" className="lexicon-edit" aria-label="编辑基本资料" disabled={!ready || busy || !!editing} onClick={() => startEdit('basic')}><Pencil size={14} aria-hidden="true"/>编辑</button></div>
      {!!details.senses.length ? details.senses.map(sense => <div key={sense.id} className="lexicon-sense"><p className="lexicon-sense-meaning"><span className="lexicon-pos">{partOfSpeechAbbreviation(sense.partOfSpeech)}</span>{sense.meaningZh || sense.text}</p>{(sense.example || sense.exampleTranslation) && <EntryExample entry={sense} pronounce={pronounce}/>}</div>) : <p className="lexicon-muted">尚未填写释义，可手动编辑或生成详细资料。</p>}
      {(details.category || details.type) === 'word' && !!details.inflections.length && <dl className="lexicon-inflections">{orderedInflections(details.inflections).map((form, i) => <div key={i}><dt>{inflectionLabel(form.label)}</dt><dd>{form.value}</dd></div>)}</dl>}
    </div>
    <div className="lexicon-tabs" role="tablist" aria-label="词汇资料栏目">{DETAIL_SECTIONS.map((key, index) => <button type="button" key={key} id={`lexicon-tab-${vocab.id}-${key}`} role="tab" aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} aria-controls={`lexicon-content-${vocab.id}`} disabled={!!editing} onClick={() => { setTab(key); setMessage(''); }} onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 5 : (index + (event.key === 'ArrowRight' ? 1 : 5)) % 6; setTab(DETAIL_SECTIONS[next]); const row = event.currentTarget.parentElement;
        const target = row?.children[next] as HTMLButtonElement | undefined;
        target?.focus({ preventScroll: true });
        if (row && target) { const bounds = row.getBoundingClientRect(); const button = target.getBoundingClientRect(); row.scrollLeft += button.left < bounds.left ? button.left - bounds.left : button.right > bounds.right ? button.right - bounds.right : 0; } }
    }}><span className="lexicon-tab-label">{sectionLabels[key]}</span></button>)}</div>
    {!editing && <div id={`lexicon-content-${vocab.id}`} role="tabpanel" tabIndex={0} aria-labelledby={`lexicon-tab-${vocab.id}-${tab}`} className="lexicon-content">
      {tab === 'usage' && (items.length > 0 || (!busy && !error)) ? <UsageList entries={items} pronounce={pronounce} manual={details.provenance.usage?.source === 'user'}/> : tab === 'derivatives' && (items.length > 0 || !busy) ? <DerivativeList manual={details.provenance.derivatives?.source === 'user'} entries={items} term={vocab.term} inflections={details.inflections.map(form => form.value)} pronounce={pronounce}/> : tab === 'roots' && (items.length > 0 || !busy) ? <RootAnalysisList manual={details.provenance.roots?.source === 'user'} entries={items} term={vocab.term} pronounce={pronounce}/> : items.length ? tab === 'definitions' ? <DefinitionCards entries={items} pronounce={pronounce}/> : tab === 'phrases' ? <PhraseList entries={items} busy={busy} isSaved={text => savedKeys.has(materialKey('phrase', text))} pronounce={pronounce} onToggle={entry => void perform(async () => { await toggleMaterial(vocab, 'phrases', entry); })}/> : <ExampleSenseCards entries={items} senses={details.senses} defaultPos={vocab.partOfSpeech} busy={busy} isSaved={text=>savedKeys.has(materialKey('example',text))} pronounce={pronounce} onToggle={entry=>void perform(async()=>{await toggleMaterial(vocab,'examples',entry);})}/> : <StudyEmptyState compact pose={busy ? 'cat-thinking' : 'hamster-reading'} busy={busy}><p className="lexicon-empty">{busy ? '正在准备本栏资料…' : error ? '本栏资料未能生成，已有内容已保留。' : details.generatedSections?.includes(tab) ? '暂无可靠或适用的内容，可手动补充。' : '本栏尚未生成，可先使用已有资料或手动填写。'}</p></StudyEmptyState>}
      <div className="lexicon-section-tools">
        <button type="button" className="lexicon-edit" disabled={!ready || busy} onClick={() => startEdit(tab)}><Pencil size={14} aria-hidden="true"/>编辑本栏</button>
        {tab === 'usage' && (
          <button type="button" disabled={!ready || busy} onClick={() => details.provenance.usage?.source === 'user' ? setConfirmUsageReplacement(true) : generate('usage')}>
            {items.length || details.generatedSections?.includes('usage') ? '重新生成' : '生成用法解析'}
          </button>
        )}
      </div>
      {confirmUsageReplacement && <div className="lexicon-confirm" role="group" aria-label="确认重新生成用法解析"><p>重新生成会替换本栏的手动修改。</p><button type="button" disabled={busy} onClick={() => generate('usage', true)}>确认重新生成</button><button type="button" disabled={busy} onClick={() => setConfirmUsageReplacement(false)}>取消</button></div>}
    </div>}
    {editing && draft && <form className={`lexicon-editor${editing === 'usage' ? ' lexicon-editor--usage' : editing === 'basic' ? '' : ' lexicon-editor--detail'}`} onSubmit={event => { event.preventDefault(); save(); }}>{editing === 'basic' && <h3>编辑基本资料</h3>}
      {editing === 'basic' && <div className="lexicon-editor-fields"><label>英式音标（选填）<input placeholder="例如 /kənˈsɪd.ər.ət/" value={draft.phoneticUK} onChange={event => setDraft({ ...draft, phoneticUK: event.target.value })}/></label><label>美式音标（选填）<input placeholder="例如 /kənˈsɪd.ɚ.ət/" value={draft.phoneticUS} onChange={event => setDraft({ ...draft, phoneticUS: event.target.value })}/></label></div>}
      {editing === 'usage' ? <UsageEditor entries={draft.sections.usage} onChange={usage => setDraft(current => current ? { ...current, sections: { ...current.sections, usage: typeof usage === 'function' ? usage(current.sections.usage) : usage } } : current)}/> : editing === 'basic' ? editorEntries(draft.senses, 'basic') : <>
        <div className="lexicon-editor-toolbar lexicon-editor-toolbar--detail">
          <span>{sectionLabels[editing]} <small>({draft.sections[editing].length})</small></span>
          <div>
            {draft.sections[editing].length > 1 && ['examples', 'derivatives', 'phrases'].includes(editing) && <>
              <button type="button" className="lexicon-link" disabled={draft.sections[editing].every(entry => openEditorEntries.has(entry.id))} onClick={() => setOpenEditorEntries(new Set(draft.sections[editing].map(entry => entry.id)))}>展开本栏条目</button>
              <button type="button" className="lexicon-link" disabled={!openEditorEntries.size} onClick={() => setOpenEditorEntries(new Set())}>收起本栏条目</button>
            </>}
            <button type="button" className="lexicon-link lexicon-inline-add" onClick={() => {
              const entry: LearningEntry = { id: crypto.randomUUID(), text: '', meaningZh: '' };
              setEditorEntries(editing, [...draft.sections[editing], entry]);
              setOpenEditorEntries(previous => new Set(previous).add(entry.id));
            }}><Plus size={16}/>添加{editorLabels[editing]}</button>
          </div>
        </div>
        <div className="lexicon-editor-item-list">{editorEntries(draft.sections[editing], editing)}</div>
      </>}
      {editing === 'basic' && <button type="button" className="lexicon-link" onClick={() => {
        const entry: LearningEntry = { id: crypto.randomUUID(), text: '', meaningZh: '' };
        setEditorEntries('basic', [...draft.senses, entry]);
      }}><Plus size={16}/>添加{editorLabels[editing]}</button>}
      {editing === 'basic' && (details.category || details.type) === 'word' && <fieldset className="lexicon-editor-inflections"><legend><span>适用的词形变化 <small>({draft.inflections.length})</small></span><button type="button" className="lexicon-link lexicon-inline-add" onClick={() => setDraft(current => current ? { ...current, inflections: [...current.inflections, { label: '', value: '' }] } : current)}><Plus size={16}/>添加</button></legend>{draft.inflections.map((form, index) => <div className="lexicon-form-row" key={`${form.label}:${form.value}:${index}`}><label>词形类型<input placeholder="例如 名词复数" value={form.label} onChange={event => setDraft(current => current ? { ...current, inflections: current.inflections.map((v, i) => i === index ? { ...v, label: event.target.value } : v) } : current)}/></label><label>变化后的英文<input placeholder="例如 conflicts" value={form.value} onChange={event => setDraft(current => current ? { ...current, inflections: current.inflections.map((v, i) => i === index ? { ...v, value: event.target.value } : v) } : current)}/></label><button type="button" aria-label={`删除词形 ${index+1}`} onClick={() => {
        setDraft(current => current ? { ...current, inflections: current.inflections.filter((_, i) => i !== index) } : current);
        recordEditorUndo(() => setDraft(current => current ? { ...current, inflections: [...current.inflections.slice(0, Math.min(index, current.inflections.length)), form, ...current.inflections.slice(Math.min(index, current.inflections.length))] } : current), '词形已删除');
      }}><Trash2 size={16}/></button></div>)}</fieldset>}
      <div className={`lexicon-actions${editing === 'usage' ? ' lexicon-actions--usage' : editing !== 'basic' ? ' lexicon-actions--detail' : ''}`}><button type="button" disabled={busy} onClick={() => { setDraft(null); setEditing(null); }}>取消</button><button type="submit" className="lexicon-primary" disabled={busy}>保存修改</button></div>
    </form>}
    <EditorUndoNotice/>
    <LoadingAnimation active={busy} operation={details.generated ? 'wait' : loadingOperation} label="正在处理，请稍候…"/>{error && <div role="alert" className="wordbook-error"><p>{error}</p>{!details.generated && <button type="button" disabled={busy || !ready || !!editing} onClick={() => generate()}>重试生成资料</button>}</div>}{message && <p role="status" className="lexicon-muted">{message}</p>}
  </div>;
}
