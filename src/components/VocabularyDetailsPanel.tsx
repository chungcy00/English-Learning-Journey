import { LoadingAnimation } from './LoadingAnimation';
import { StudyEmptyState } from './LearningArt';
import React, { useEffect, useRef, useState } from 'react';
import { PhraseList, UsageList, usageLabels } from './PhraseUsage';
import { DerivativeList, RootAnalysisList, WordFormationEditor, DerivativeFamilyEditor } from './WordFormation';
import { ExampleSenseCards } from './ExampleSenseCards';
import { DefinitionCards } from './DefinitionCards';
import { partOfSpeechAbbreviation } from '../utils/wordFormation';
import { Pencil, Plus, Volume2, X } from 'lucide-react';
import { DETAIL_SECTIONS, USAGE_HEADINGS, type DetailSection, type LearningEntry, type VocabularyDetails, type VocabularyItem } from '../types';
import { legacyDetails, sectionLabels, materialKey, categoryLabels, inflectionLabel, orderedInflections, vocabularyKey } from '../utils/vocabularyDetails';
import { readVocabularyDetails, saveVocabularyDetails, generateVocabularyDetails, toggleMaterial } from '../services/vocabularyDetails';
import { db } from '../db/dexie';
import { speakEnglishTerm } from '../utils/speech';

type EditorSection = DetailSection | 'basic';
type EditField = [keyof LearningEntry, label: string, placeholder: string, multiline?: boolean];

const chinese: EditField = ['meaningZh', '中文释义', '例如：体贴的；考虑周到的'];
const posField: EditField = ['partOfSpeech', '词性（选填）', '例如 adj. 或形容词'];
const example: EditField = ['example', '英文例句（选填）', '例如 That was considerate of you.', true];
const translation: EditField = ['exampleTranslation', '例句译文（选填）', '例如：你想得真周到。', true];
const note: EditField = ['note', '补充说明（选填）', '需要时补充简短说明', true];
const editorLabels: Record<EditorSection, string> = {
  basic: '释义', examples: '例句', roots: '构词分析', derivatives: '派生词',
  phrases: '词组', definitions: '英文释义', usage: '用法要点',
};

function editorFields(section: EditorSection, entry: LearningEntry): { main: EditField[]; extra?: EditField[] } {
  switch (section) {
    case 'basic': return { main: [posField, chinese], extra: [example, translation, ...(!entry.meaningZh && entry.text ? [['text', '原有释义', '可填写中文释义'] as EditField] : [])] };
    case 'examples': return entry.example ? {
      main: [['example', '英文例句', '输入一个完整句子', true], translation],
      extra: [['text', '原有英文短语', '输入例句中的表达'], ['meaningZh', '原有中文词义', '例如：根深蒂固的'], note],
    } : {
      main: [['text', '英文例句', '输入一个完整句子', true], ['meaningZh', '例句译文（选填）', '输入整句的中文翻译', true]], extra: [note],
    };
    case 'roots': return { main: [] };
    case 'derivatives': return { main: [['text', '英文派生词', '例如 considerately'], posField, chinese], extra: [note, example, translation].filter(([key]) => Boolean(entry[key])) };
    case 'phrases': return { main: [['text', '完整英文词组', '例如 considerate of others'], ['meaningZh', '词组的中文意思', '例如：为他人着想']], extra: [example, translation, note] };
    case 'definitions': return { main: [['text', '英文定义', '用简短、自然的英文解释一个词义', true]] };
    case 'usage': return { main: [['meaningZh', '中文用法说明', '说明什么时候用、怎么用，或为什么这样用', true]], extra: [
      ...(!entry.usageKind || entry.usageKind === 'register' || entry.usageKind === 'natural' ? [['text', '原有说明', '可将原说明整理到上方的中文用法说明' , true] as EditField] : []), example, translation, note,
    ] };
  }
}

export function VocabularyDetailsPanel({ vocab, onBeforePronunciation, onInteractionStateChange, loadingOperation = 'vocabulary' }: { key?: string; loadingOperation?: 'vocabulary' | 'analysis'; vocab: VocabularyItem; onBeforePronunciation?: () => void; onInteractionStateChange?: (busy: boolean) => void }) {
  const [details, setDetails] = useState<VocabularyDetails>(() => legacyDetails(vocab));
  const [tab, setTab] = useState<DetailSection>('examples');
  const [draft, setDraft] = useState<VocabularyDetails | null>(null);
  const [editing, setEditing] = useState<DetailSection | 'basic' | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const lock = useRef(false);
  const run = useRef(0);
  useEffect(() => { onInteractionStateChange?.(!!editing); }, [busy, editing, onInteractionStateChange]);
  useEffect(() => () => onInteractionStateChange?.(false), [onInteractionStateChange]);
  useEffect(() => {
    const id = ++run.current;
    setDetails(legacyDetails(vocab)); setDraft(null); setEditing(null); setError(''); setMessage(''); setReady(false); setTab('examples');
    readVocabularyDetails(vocab).then(value => { if (run.current === id) { setDetails(value); setReady(true); if (!value.generated) generate(); } }).catch(() => { if (run.current === id) setError('本地资料读取失败，请关闭后重试。'); });
    return () => { run.current++; };
  }, [vocab.id, vocab.term]);
  useEffect(() => {
    let active = true;
    const refresh = () => { void db.vocabularyDetails.get(vocabularyKey(vocab.term,vocab.type)).then(value=>{if(active&&value)setDetails(value);}).catch(()=>{if(active)setError('本地用法资料更新读取失败，请稍后重试。');}); return void db.savedMaterials.toArray().then(items => { if (active) setSavedKeys(new Set(items.map(item => item.key))); }).catch(() => { if (active) setError('收藏读取失败，请稍后重试。'); }); };
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
  const generate = (section?: DetailSection) => void perform(async () => {
    const id = run.current;
    const value = await generateVocabularyDetails(vocab, section);
    if (id === run.current) setDetails(value);
  });
  const startEdit = (section: DetailSection | 'basic') => { const copy = structuredClone(details); copy.inflections = copy.inflections.map(form => ({ ...form, label: inflectionLabel(form.label) })); setDraft(copy); setEditing(section); setError(''); setMessage(''); };
  const save = () => void perform(async () => {
    if (!draft || !editing) return;
    const now = Date.now();
    const latest = await readVocabularyDetails(vocab);
    const editedEntries = editing === 'basic' ? [] : draft.sections[editing].map(item => {
      if (editing === 'usage' && item.usageKind && Object.hasOwn(usageLabels, item.usageKind)) {
        return { ...item, text: item.text.trim() || usageLabels[item.usageKind] };
      }
      if (editing === 'roots' && item.morphology) {
        const root = item.morphology.root.trim() || item.morphology.parts.find(part => part.kind === 'root')?.text.trim();
        return { ...item, text: item.text.trim() || root || '', meaningZh: item.meaningZh.trim() || item.morphology.meaningZh };
      }
      if (editing === 'examples' && !item.text.trim() && item.example?.trim()) return { ...item, text: item.example };

      return item;
    }).filter(item => item.text.trim());
    const next: VocabularyDetails = { ...latest, ...(editing === 'basic' ? { phoneticUK: draft.phoneticUK.trim(), phoneticUS: draft.phoneticUS.trim(), senses: draft.senses.filter(item => item.text.trim() || item.meaningZh.trim()), inflections: (details.category || details.type) === 'word' ? draft.inflections.filter(item => item.label.trim() && item.value.trim()) : [] } : {}),
      sections: { ...latest.sections, ...(editing !== 'basic' ? { [editing]: editedEntries } : {}) },
      provenance: { ...latest.provenance, [editing]: { source: 'user' as const, updatedAt: now } }, updatedAt: now };
    await saveVocabularyDetails(next); setDetails(next); setDraft(null); setEditing(null); setMessage('修改已保存。');
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
  const editorEntries = (entries: LearningEntry[], section: EditorSection) => entries.map((entry, index) => {
    const fields = editorFields(section, entry);
    const renderField = ([field, label, placeholder, multiline]: EditField) => {
      const value = entry[field];
      const props = { placeholder, maxLength: 3000, value: typeof value === 'string' ? value : '',
        onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => patchEntry(index, field, event.target.value) };
      return <label key={field} className={multiline ? 'lexicon-editor-wide' : undefined}>{label}
        {multiline ? <textarea rows={2} {...props}/> : <input {...props}/>}
      </label>;
    };
    return <fieldset key={entry.id} className="lexicon-editor-entry"><legend>{editorLabels[section]} {index + 1}</legend>
    {editing === 'examples' && <div className="lexicon-editor-fields">
      <label>对应的中文词义<select value={entry.senseId || ''} onChange={event=>patchEntry(index,'senseId',event.target.value)}><option value="">不关联已有词义</option>{draft?.senses.map(sense=><option key={sense.id} value={sense.id}>{partOfSpeechAbbreviation(sense.partOfSpeech)} {sense.meaningZh || sense.text}</option>)}</select></label>
      {renderField(['senseMeaningZh','单独填写本组词义（选填）','例如：根深蒂固的'])}
      {renderField(posField)}
    </div>}
    {editing === 'usage' && <><label>用法类别<select value={entry.usageKind && Object.hasOwn(USAGE_HEADINGS, entry.usageKind) ? entry.usageKind : ''} onChange={event => {
      if (!draft) return;
      const kind = event.target.value as LearningEntry['usageKind'];
      setDraft({ ...draft, sections: { ...draft.sections, usage: draft.sections.usage.map((v,i) => i === index ? { ...v, usageKind: kind || undefined, contrast: v.contrast } : v) } });
    }}><option value="" disabled hidden>请选择用法类别</option>{Object.entries(USAGE_HEADINGS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {entry.usageKind === 'error' && <>{(['incorrect','correct'] as const).map(key => <label key={key}>{key === 'incorrect' ? '错误写法' : '正确写法'}<textarea value={entry.contrast?.[key] || ''} onChange={event => patchEntry(index, 'contrast', { incorrect: entry.contrast?.incorrect || '', correct: entry.contrast?.correct || '', [key]: event.target.value })}/></label>)}</>}
    </>}
    {!!fields.main.length && <div className="lexicon-editor-fields">{fields.main.map(renderField)}</div>}
    {!!fields.extra?.length && <details className="lexicon-editor-optional"><summary>补充资料（选填）</summary><div className="lexicon-editor-fields">{fields.extra.map(renderField)}</div></details>}
    {editing === 'derivatives' && <DerivativeFamilyEditor entry={entry} onChange={family => patchEntry(index, 'family', family)}/>}
    {editing === 'roots' && <WordFormationEditor entry={entry} onChange={next => patchEntry(index, 'morphology', next.morphology)}/>}
    <button type="button" className="lexicon-link" onClick={() => {
      if (!draft || !editing) return;
      const next = entries.filter((_, i) => i !== index);
      setDraft(editing === 'basic' ? { ...draft, senses: next } : { ...draft, sections: { ...draft.sections, [editing]: next } });
    }}>移除这条{editorLabels[section]}</button>
  </fieldset>;
  });
  return <div className="lexicon-panel" aria-busy={busy}>
    <div className="lexicon-basic">
      <p className="lexicon-kind">{category ? `${categoryLabels[category]} · ${category === 'phrasal-verb' ? 'phrasal verb' : category}` : details.generated ? `${categoryLabels[details.type] || '词条'} · ${details.type}` : '多词表达 · 生成时自动细分类型'}</p>
      <div className="lexicon-pronunciations">{([['en-GB', '英', details.phoneticUK], ['en-US', '美', details.phoneticUS]] as const).map(([lang, label, ipa]) => <button key={lang} type="button" onClick={() => pronounce(vocab.term, lang)} aria-label={`${label}式发音：${vocab.term}`}><Volume2 size={17} aria-hidden="true"/>{label}{ipa && <span>{ipa}</span>}</button>)}<button type="button" className="lexicon-edit" aria-label="编辑基本资料" disabled={!ready || busy || !!editing} onClick={() => startEdit('basic')}><Pencil size={14} aria-hidden="true"/>编辑</button></div>
      {!!details.senses.length ? details.senses.map(sense => <div key={sense.id} className="lexicon-sense"><p className="lexicon-sense-meaning"><span className="lexicon-pos">{partOfSpeechAbbreviation(sense.partOfSpeech)}</span>{sense.meaningZh || sense.text}</p>{sense.example && <><p lang="en">{sense.example}</p>{sense.exampleTranslation && <p className="lexicon-muted">{sense.exampleTranslation}</p>}</>}</div>) : <p className="lexicon-muted">尚未填写释义，可手动编辑或生成详细资料。</p>}
      {(details.category || details.type) === 'word' && !!details.inflections.length && <dl className="lexicon-inflections">{orderedInflections(details.inflections).map((form, i) => <div key={i}><dt>{inflectionLabel(form.label)}</dt><dd>{form.value}</dd></div>)}</dl>}
    </div>
    <div className="lexicon-tabs" role="tablist" aria-label="词汇资料栏目">{DETAIL_SECTIONS.map((key, index) => <button type="button" key={key} id={`lexicon-tab-${vocab.id}-${key}`} role="tab" aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} aria-controls={`lexicon-content-${vocab.id}`} disabled={!!editing} onClick={() => { setTab(key); setMessage(''); }} onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 5 : (index + (event.key === 'ArrowRight' ? 1 : 5)) % 6; setTab(DETAIL_SECTIONS[next]); const row = event.currentTarget.parentElement;
        const target = row?.children[next] as HTMLButtonElement | undefined;
        target?.focus({ preventScroll: true });
        if (row && target) { const bounds = row.getBoundingClientRect(); const button = target.getBoundingClientRect(); row.scrollLeft += button.left < bounds.left ? button.left - bounds.left : button.right > bounds.right ? button.right - bounds.right : 0; } }
    }}><span className="lexicon-tab-label">{sectionLabels[key]}</span></button>)}</div>
    {!editing && <div id={`lexicon-content-${vocab.id}`} role="tabpanel" tabIndex={0} aria-labelledby={`lexicon-tab-${vocab.id}-${tab}`} className="lexicon-content">
      <div className="lexicon-section-tools"><button type="button" className="lexicon-edit" disabled={!ready || busy} onClick={() => startEdit(tab)}><Pencil size={14} aria-hidden="true"/>编辑本栏</button>{tab === 'usage' && details.provenance.usage?.source !== 'user' && <button type="button" disabled={!ready || busy} onClick={() => generate('usage')}>{items.length || details.generatedSections?.includes('usage') ? '重新生成用法解析' : '生成用法解析'}</button>}</div>
      {tab === 'usage' && (items.length > 0 || (!busy && !error)) ? <UsageList entries={items} pronounce={pronounce} manual={details.provenance.usage?.source === 'user'}/> : tab === 'derivatives' && (items.length > 0 || !busy) ? <DerivativeList entries={items} term={vocab.term} inflections={details.inflections.map(form => form.value)} pronounce={pronounce}/> : tab === 'roots' && (items.length > 0 || !busy) ? <RootAnalysisList entries={items} term={vocab.term} pronounce={pronounce}/> : items.length ? tab === 'definitions' ? <DefinitionCards entries={items} pronounce={pronounce}/> : tab === 'phrases' ? <PhraseList entries={items} busy={busy} isSaved={text => savedKeys.has(materialKey('phrase', text))} pronounce={pronounce} onToggle={entry => void perform(async () => { await toggleMaterial(vocab, 'phrases', entry); })}/> : <ExampleSenseCards entries={items} senses={details.senses} defaultPos={vocab.partOfSpeech} busy={busy} isSaved={text=>savedKeys.has(materialKey('example',text))} pronounce={pronounce} onToggle={entry=>void perform(async()=>{await toggleMaterial(vocab,'examples',entry);})}/> : <StudyEmptyState compact pose={busy ? 'cat-thinking' : 'hamster-reading'} busy={busy}><p className="lexicon-empty">{busy ? '正在准备本栏资料…' : error ? '本栏资料未能生成，已有内容已保留。' : details.generatedSections?.includes(tab) ? '暂无可靠或适用的内容，可手动补充。' : '本栏尚未生成，可先使用已有资料或手动填写。'}</p></StudyEmptyState>}
    </div>}
    {editing && draft && <form className="lexicon-editor" onSubmit={event => { event.preventDefault(); save(); }}><h3>编辑{editing === 'basic' ? '基本资料' : sectionLabels[editing]}</h3>
      {editing === 'basic' && <div className="lexicon-editor-fields"><label>英式音标（选填）<input placeholder="例如 /kənˈsɪd.ər.ət/" value={draft.phoneticUK} onChange={event => setDraft({ ...draft, phoneticUK: event.target.value })}/></label><label>美式音标（选填）<input placeholder="例如 /kənˈsɪd.ɚ.ət/" value={draft.phoneticUS} onChange={event => setDraft({ ...draft, phoneticUS: event.target.value })}/></label></div>}
      {editorEntries(editing === 'basic' ? draft.senses : draft.sections[editing], editing)}
      <button type="button" className="lexicon-link" onClick={() => {
        const entry: LearningEntry = { id: crypto.randomUUID(), text: '', meaningZh: '', ...(editing === 'usage' ? { usageKind: 'scenario' } : {}) };
        setDraft(editing === 'basic' ? { ...draft, senses: [...draft.senses, entry] } : { ...draft, sections: { ...draft.sections, [editing]: [...draft.sections[editing], entry] } });
      }}><Plus size={16}/>添加{editorLabels[editing]}</button>
      {editing === 'basic' && (details.category || details.type) === 'word' && <fieldset><legend>适用的词形变化</legend>{draft.inflections.map((form, index) => <div className="lexicon-form-row" key={index}><label>词形类型<input placeholder="例如 名词复数" value={form.label} onChange={event => setDraft({ ...draft, inflections: draft.inflections.map((v, i) => i === index ? { ...v, label: event.target.value } : v) })}/></label><label>变化后的英文<input placeholder="例如 conflicts" value={form.value} onChange={event => setDraft({ ...draft, inflections: draft.inflections.map((v, i) => i === index ? { ...v, value: event.target.value } : v) })}/></label><button type="button" aria-label="删除词形" onClick={() => setDraft({ ...draft, inflections: draft.inflections.filter((_, i) => i !== index) })}><X size={16}/></button></div>)}<button type="button" onClick={() => setDraft({ ...draft, inflections: [...draft.inflections, { label: '', value: '' }] })}>添加词形</button></fieldset>}
      <div className="lexicon-actions"><button type="submit" className="lexicon-primary" disabled={busy}>保存修改</button><button type="button" disabled={busy} onClick={() => { setDraft(null); setEditing(null); }}>取消</button></div>
    </form>}
    <LoadingAnimation active={busy} operation={details.generated ? 'wait' : loadingOperation} label="正在处理，请稍候…"/>{error && <div role="alert" className="wordbook-error"><p>{error}</p>{!details.generated && <button type="button" disabled={busy || !ready || !!editing} onClick={() => generate()}>重试生成资料</button>}</div>}{message && <p role="status" className="lexicon-muted">{message}</p>}
  </div>;
}
