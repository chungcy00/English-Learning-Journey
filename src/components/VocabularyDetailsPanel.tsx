import { useModalDialog } from '../hooks/useModalDialog';
import { LoadingAnimation } from './LoadingAnimation';
import { StudyEmptyState } from './LearningArt';
import React, { useEffect, useId, useRef, useState } from 'react';
import { EntryExample, PhraseList } from './PhraseUsage';
import { UsageList } from './UsageAnalysis';
import { UsageEditor, ExampleListEditor } from './UsageEditor';
import { AutoTextarea } from './AutoTextarea';
import { EditorOrderActions, EditorUndoNotice, EditorUndoProvider, useClearEditorUndo, useEditorUndo } from './EditorControls';
import { structuredUsage, upgradeUsageDetails, usageEntry, usageValidationError } from '../utils/structuredUsage';
import { DerivativeList, RootAnalysisList, WordFormationEditor, DerivativeFamilyEditor } from './WordFormation';
import { ExampleSenseCards, groupSenseExamples } from './ExampleSenseCards';
import { DefinitionCards } from './DefinitionCards';
import { partOfSpeechAbbreviation } from '../utils/wordFormation';
import { ChevronDown, Pencil, Plus, Trash2, Volume2 } from 'lucide-react';
import { DETAIL_SECTIONS, type DetailSection, type LearningEntry, type VocabularyDetails, type VocabularyItem } from '../types';
import { legacyDetails, sectionLabels, materialKey, categoryLabels, inflectionLabel, orderedInflections, vocabularyKey } from '../utils/vocabularyDetails';
import { readVocabularyDetails, saveVocabularyDetails, generateVocabularyDetails, toggleMaterial } from '../services/vocabularyDetails';
import { db } from '../db/dexie';
import { speakEnglishTerm } from '../utils/speech';

import { editorSnapshot, entryExamples, prepareEditor, type EditorSection } from '../utils/vocabularyEditor';
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
    case 'examples': return {
      main: [['text', '英文例句', '输入一个完整句子', true], ['meaningZh', '中文译文', '输入整句的中文翻译', true]], extra: [note],
    };
    case 'roots': return { main: [] };
    case 'derivatives': return { main: [['text', '英文派生词', '例如 considerately'], posField, chinese], extra: [note] };
    case 'phrases': return { main: [['text', '完整英文词组', '例如 considerate of others'], ['meaningZh', '词组的中文意思', '例如：为他人着想']], extra: [note] };
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

type PanelProps = { key?: string; loadingOperation?: 'vocabulary' | 'analysis'; vocab: VocabularyItem; onBeforePronunciation?: () => void; onInteractionStateChange?: (busy: boolean) => void };
export function VocabularyDetailsPanel(props: PanelProps) {
  return <EditorUndoProvider><VocabularyDetailsEditor {...props}/></EditorUndoProvider>;
}
function VocabularyDetailsEditor({ vocab, onBeforePronunciation, onInteractionStateChange, loadingOperation = 'vocabulary' }: PanelProps) {
  const recordEditorUndo = useEditorUndo();
  const clearUndo = useClearEditorUndo();
  const formRef = useRef<HTMLFormElement>(null);
  const draftBaseline = useRef('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const discardDialogRef = useModalDialog(confirmDiscard);
  const discardDialogId = useId();
  const [foldableEditor, setFoldableEditor] = useState(false);
  const [invalidEntryId, setInvalidEntryId] = useState('');
  const [exampleGroupIds, setExampleGroupIds] = useState<Record<string,string>>({});

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
  const dirty = !!editing && !!draft && editorSnapshot(draft, editing) !== draftBaseline.current;
  const draftKey = `lexicon-editor-draft:${vocabularyKey(vocab.term, vocab.type)}`;
  useEffect(() => {
    if (!draft || !editing) return;
    if (!dirty) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
        if (saved?.section === editing) sessionStorage.removeItem(draftKey);
      } catch { /* An unreadable draft does not affect the active form. */ }
      return;
    }
    try { sessionStorage.setItem(draftKey, JSON.stringify({ section: editing, draft, baseline: editBaseline.current, initialSnapshot: draftBaseline.current })); } catch { /* The in-memory draft remains editable when storage is full. */ }
    const preventLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventLeave);
    return () => window.removeEventListener('beforeunload', preventLeave);
  }, [dirty, draft, editing, draftKey]);
  useEffect(() => {
    if (!invalidEntryId) return;
    const frame = requestAnimationFrame(() => {
      const item = Array.from<HTMLElement>(formRef.current?.querySelectorAll<HTMLElement>('[data-editor-entry]') || []).find(element => element.dataset.editorEntry === invalidEntryId);
      if (!item) return;
      item.querySelectorAll('details').forEach(details => { details.open = true; });
      const fields = Array.from<HTMLInputElement | HTMLTextAreaElement>(item.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-editor-required]'));
      const field = fields.find(input => !input.value.trim()) || item.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea,select');
      item.scrollIntoView({ block: 'center', behavior: 'auto' });
      field?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [invalidEntryId, error]);
  const lock = useRef(false);
  const run = useRef(0);
  useEffect(() => { onInteractionStateChange?.(!!editing); }, [busy, editing, onInteractionStateChange]);
  useEffect(() => () => onInteractionStateChange?.(false), [onInteractionStateChange]);
  useEffect(() => {
    const id = ++run.current;
    clearUndo();
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
  const closeEditor = () => {
    clearUndo();
    try { sessionStorage.removeItem(draftKey); } catch { /* Storage can be disabled. */ }
    setDraft(null); setEditing(null); setConfirmDiscard(false); setInvalidEntryId(''); setError(''); setMessage('');
  };
  const startEdit = (section: EditorSection) => {
    let copy = prepareEditor(upgradeUsageDetails(details), section);
    copy.inflections = copy.inflections.map(form => ({ ...form, label: inflectionLabel(form.label) }));
    editBaseline.current = editorSnapshot(upgradeUsageDetails(details), section);
    draftBaseline.current = editorSnapshot(copy, section);
    let restored = false;
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
      if (saved?.section === section && saved.draft?.key === copy.key && typeof saved.baseline === 'string' && typeof saved.initialSnapshot === 'string') {
        copy = prepareEditor(saved.draft, section); editBaseline.current = saved.baseline; draftBaseline.current = saved.initialSnapshot; restored = true;
      }
    } catch { /* A malformed draft never replaces saved learning content. */ }
    if (section === 'examples') {
      const assignments: Record<string,string> = {};
      groupSenseExamples(copy.sections.examples, copy.senses, vocab.partOfSpeech).forEach(group => group.examples.forEach(example => { assignments[example.source.id] = group.examples[0].source.id; }));
      setExampleGroupIds(assignments);
    }
    clearUndo(); setOpenEditorEntries(new Set()); setConfirmDiscard(false); setInvalidEntryId('');
    setFoldableEditor(section !== 'basic' && copy.sections[section].length > 1);
    setConfirmUsageReplacement(false);
    setDraft(copy); setEditing(section); setError(''); setMessage(restored ? '已恢复本页尚未保存的草稿。' : '');
  };
  const rejectEntry = (entry: LearningEntry, problem: string): never => {
    setInvalidEntryId(entry.id); setOpenEditorEntries(previous => new Set(previous).add(entry.id));
    throw new Error(problem);
  };
  const save = () => void perform(async () => {
    if (!draft || !editing) return;
    const now = Date.now();
    const latest = await readVocabularyDetails(vocab);
    if (editorSnapshot(latest, editing) !== editBaseline.current) {
      throw new Error('本栏资料已在其他窗口更新。当前填写内容已保留，请取消后重新打开，核对最新资料再编辑。');
    }
    if (editing === 'usage') {
      for (const entry of draft.sections.usage) {
        const problem = usageValidationError(structuredUsage(entry));
        if (problem) rejectEntry(entry, problem);
      }
    }
    if (editing !== 'basic' && editing !== 'usage' && editing !== 'roots') {
      for (const item of draft.sections[editing]) {
        const hasContent = [item.text, item.meaningZh, item.example, item.exampleTranslation, item.note, item.associatedExpression, item.associatedMeaningZh, item.senseMeaningZh, item.family?.relation, item.family?.parent].some(value => value?.trim()) || !!item.examples?.length || !!item.family?.parts?.length;
        if (item.examples?.some(example => !example.english.trim() || !example.chinese.trim())) rejectEntry(item, '请为每条例句同时填写英文原句和中文译文，或删除空例句。');
        if (hasContent && !item.text.trim()) rejectEntry(item, '请填写英文内容后保存，或删除不需要的空项目。');
        if (editing === 'definitions' && item.text.trim() && (!/[a-z]/i.test(item.text) || /[\u3400-\u9fff]/.test(item.text))) {
          rejectEntry(item, '英文释义请填写纯英文内容。当前修改已保留。');
        }
      }
    }
    const editedEntries = editing === 'basic' ? [] : draft.sections[editing].map(item => {
      if (editing === 'usage') return usageEntry(item.id, structuredUsage(item));
      if (editing === 'roots' && item.morphology) {
        return { ...item, text: '', meaningZh: '', morphology: { ...item.morphology, parts: item.morphology.parts.map(part => ({ ...part })) } };
      }
      if (editing === 'examples' && !item.text.trim() && item.example?.trim()) return { ...item, text: item.example };

      return item;
    }).filter(item => editing === 'usage' || (editing === 'roots'
      ? !!(item.morphology?.parts.some(part => part.text.trim() || part.meaningZh.trim()) || item.morphology?.explanation.trim() || item.morphology?.mnemonic.trim() || item.morphology?.related.length)
      : item.text.trim()));
    const next: VocabularyDetails = { ...latest, ...(editing === 'basic' ? { phoneticUK: draft.phoneticUK.trim(), phoneticUS: draft.phoneticUS.trim(), senses: draft.senses.filter(item => item.text.trim() || item.meaningZh.trim()), inflections: (details.category || details.type) === 'word' ? draft.inflections.filter(item => item.label.trim() && item.value.trim()) : [] } : {}),
      sections: { ...latest.sections, ...(editing !== 'basic' ? { [editing]: editedEntries } : {}) },
      provenance: { ...latest.provenance, [editing]: { source: 'user' as const, updatedAt: now } }, updatedAt: now };
    const saved = await saveVocabularyDetails(next, undefined, { section: editing, baseline: editBaseline.current });
    setDetails(saved); closeEditor(); setMessage('修改已保存。');
  });
  const pronounce = (text: string, accent?: 'en-GB' | 'en-US') => { setError(''); onBeforePronunciation?.(); speakEnglishTerm(text, setError, accent); };
  const items = details.sections[tab];
  const category = details.category || (details.type === 'word' || details.type === 'idiom' ? details.type : undefined);
  const patchEntry = (index: number, field: keyof LearningEntry, value: string | LearningEntry['family'] | LearningEntry['morphology'] | LearningEntry['contrast']) => {
    if (!editing) return;
    setDraft(current => {
      if (!current) return current;
      const list = editing === 'basic' ? current.senses : current.sections[editing];
      const next = list.map((item, i) => i === index ? { ...item, [field]: value } : item);
      return editing === 'basic' ? { ...current, senses: next } : { ...current, sections: { ...current.sections, [editing]: next } };
    });
  };
  const setEditorEntries = (section: DetailSection | 'basic', update: LearningEntry[] | ((entries: LearningEntry[]) => LearningEntry[])) => {
    setDraft(current => {
      if (!current) return current;
      const entries = section === 'basic' ? current.senses : current.sections[section];
      const nextEntries = typeof update === 'function' ? update(entries) : update;
      return section === 'basic' ? { ...current, senses: nextEntries } : { ...current, sections: { ...current.sections, [section]: nextEntries } };
    });
  };
  const moveEntry = (section: EditorSection, entries: LearningEntry[], index: number, direction: number) => {
    const first = entries[index]?.id, second = entries[index + direction]?.id;
    if (!first || !second) return;
    setEditorEntries(section, current => {
      const next = [...current];
      const a = next.findIndex(item => item.id === first), b = next.findIndex(item => item.id === second);
      if (a >= 0 && b >= 0) [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };
  const addEditorEntry = (section: DetailSection, reference?: LearningEntry, familyBase = vocab.term) => {
    const current = draft?.sections[section] || [];
    const entry: LearningEntry = { id: crypto.randomUUID(), text: '', meaningZh: '' };
    if (section === 'examples') setExampleGroupIds(previous => ({ ...previous, [entry.id]: reference ? previous[reference.id] || reference.id : entry.id }));
    if (section === 'examples' && reference) {
      entry.senseId = reference.senseId; entry.senseMeaningZh = reference.senseMeaningZh; entry.partOfSpeech = reference.partOfSpeech;
    }
    if (section === 'derivatives') entry.family = { base: familyBase, relation: '' };
    if (section === 'roots') entry.morphology = { parts: [{kind:'root',text:'',meaningZh:''}], explanation:'',mnemonic:'',related:[] };
    if (current.length) setFoldableEditor(true);
    setEditorEntries(section, entries => [...entries, entry]);
    setOpenEditorEntries(previous => new Set(previous).add(entry.id));
  };
  const editorEntries = (entries: LearningEntry[], section: EditorSection) => entries.map((entry, groupIndex) => {
    const allEntries = section === 'basic' ? draft!.senses : draft!.sections[section];
    const index = allEntries.findIndex(item => item.id === entry.id);
    const fields = editorFields(section, entry);
    const heading = entryHeading(section, entry, index);
    const canFold = foldableEditor && (section === 'examples' || section === 'derivatives' || section === 'phrases');
    const open = section === 'basic' || !canFold || openEditorEntries.has(entry.id);
    const optionalFilled = !!fields.extra?.some(([field]) => {
      const value = entry[field];
      return typeof value === 'string' && value.trim();
    });
    const renderField = ([field, label, placeholder, multiline]: EditField) => {
      const value = entry[field];
      const stringValue = typeof value === 'string' ? value : '';
      return <label key={field} className={multiline ? 'lexicon-editor-wide' : undefined}>{label}
        {multiline ? <AutoTextarea maxLength={3000} value={stringValue} data-editor-required={field === 'text' ? true : undefined} onChange={next => patchEntry(index, field, next)} placeholder={placeholder}/> : <input data-editor-required={field === 'text' ? true : undefined} maxLength={3000} value={stringValue} onChange={event => patchEntry(index, field, event.target.value)} placeholder={placeholder}/>}
      </label>;
    };
    const content = <>
    {editing === 'examples' && <label>例句对应词义<select value={entry.senseMeaningZh ? '' : entry.senseId || ''} onChange={event => {
      const senseId = event.target.value;
      const matching = draft?.sections.examples.find(item => item.id !== entry.id && item.senseId === senseId && !item.senseMeaningZh);
      setExampleGroupIds(previous => ({ ...previous, [entry.id]: senseId && matching ? previous[matching.id] || matching.id : entry.id }));
      setEditorEntries(section, current => current.map(item => item.id === entry.id ? { ...item, senseId, senseMeaningZh: senseId ? '' : item.senseMeaningZh || draft?.senses.find(sense => sense.id === item.senseId)?.meaningZh || '', partOfSpeech: senseId ? '' : item.partOfSpeech || draft?.senses.find(sense => sense.id === item.senseId)?.partOfSpeech } : item));
    }}><option value="">自定义词义</option>{draft?.senses.map(sense => <option key={sense.id} value={sense.id}>{partOfSpeechAbbreviation(sense.partOfSpeech)} {sense.meaningZh || sense.text}</option>)}</select></label>}
    {editing === 'examples' && (!entry.senseId || !!entry.senseMeaningZh) && <div className="lexicon-editor-fields">{renderField(['senseMeaningZh','自定义词义（选填）','例如：根深蒂固的'])}{renderField(posField)}</div>}
    {!!fields.main.length && <div className="lexicon-editor-fields">{fields.main.map(renderField)}</div>}
    {editing === 'examples' && <details className="lexicon-editor-optional"><summary>关联表达（选填）{(entry.associatedExpression?.trim() || entry.associatedMeaningZh?.trim()) && <span className="usage-filled-indicator">已填写</span>}</summary><div className="lexicon-editor-fields">{renderField(['associatedExpression','英文表达','例如 deeply rooted'])}{renderField(['associatedMeaningZh','表达的中文意思','例如：根深蒂固的'])}</div></details>}
    {(editing === 'phrases' || editing === 'derivatives') && <ExampleListEditor collapsible label="例句" examples={entryExamples(entry)} onChange={update => setEditorEntries(section, current => current.map(item => item.id === entry.id ? { ...item, examples: typeof update === 'function' ? update(entryExamples(item)) : update, example: '', exampleTranslation: '' } : item))}/>}
    {!!fields.extra?.length && <details className="lexicon-editor-optional"><summary>补充说明（选填）{optionalFilled && <span className="usage-filled-indicator">已填写</span>}</summary><div className="lexicon-editor-fields">{fields.extra.map(field => field[0] === 'note' ? <AutoTextarea key="note" aria-label="补充说明（选填）" value={entry.note || ''} maxLength={3000} onChange={value => patchEntry(index, 'note', value)}/> : renderField(field))}</div></details>}
    {editing === 'derivatives' && <DerivativeFamilyEditor candidates={[vocab.term, ...draft!.sections.derivatives.map(item => item.text)]} entry={entry} onChange={update => setEditorEntries(section, current => current.map(item => item.id === entry.id ? { ...item, family: typeof update === 'function' ? update(item.family || {base:'',relation:''}) : update } : item))}/>}
    {editing === 'roots' && <WordFormationEditor term={vocab.term} entry={entry} onChange={update => setEditorEntries(section, current => current.map(item => item.id === entry.id ? typeof update === 'function' ? update(item) : update : item))}/>}
    {entry.id === invalidEntryId && error && <p className="editor-field-error" role="alert">{error}</p>}
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
    if (section === 'roots') return <article key={entry.id} data-editor-entry={entry.id} className="lexicon-root-editor-entry">
      {entries.length > 1 && <EditorOrderActions className="lexicon-root-editor-entry__actions" label={label} first={groupIndex === 0} last={groupIndex === entries.length - 1} onMove={direction => moveEntry(section, entries, groupIndex, direction)} onRemove={removeEntry}/>}
      {entries.length === 1 && <button type="button" className="lexicon-root-editor-entry__remove" aria-label={`删除${label}`} onClick={removeEntry}><Trash2 size={16}/></button>}
      <div className="lexicon-editor-item__content">{content}</div>
    </article>;
    if (section === 'definitions') return <article key={entry.id} data-editor-entry={entry.id} className="lexicon-definition-editor-entry">
      <div className="lexicon-editor-item__heading"><label htmlFor={`definition-${entry.id}`}>英文定义</label><EditorOrderActions label={label} first={groupIndex === 0} last={groupIndex === entries.length - 1} onMove={direction => moveEntry(section, entries, groupIndex, direction)} onRemove={removeEntry}/></div>
      <AutoTextarea id={`definition-${entry.id}`} value={entry.text} maxLength={3000} data-editor-required onChange={value => patchEntry(index, 'text', value)} placeholder="Write a short English definition." aria-invalid={!!entry.text.trim() && (!/[a-z]/i.test(entry.text) || /[\u3400-\u9fff]/.test(entry.text))}/>
      {!!entry.text.trim() && (!/[a-z]/i.test(entry.text) || /[\u3400-\u9fff]/.test(entry.text)) && <p className="editor-field-error">此栏只填写英文定义。</p>}
      {!!draft?.senses.length && <label>关联已有词义（选填）<select value={entry.senseId || ''} onChange={event => patchEntry(index, 'senseId', event.target.value)}><option value="">不关联已有词义</option>{draft.senses.map(sense => <option key={sense.id} value={sense.id}>{partOfSpeechAbbreviation(sense.partOfSpeech)} {sense.meaningZh || sense.text}</option>)}</select></label>}
    </article>;
    if (!canFold) return <article key={entry.id} data-editor-entry={entry.id} className="lexicon-editor-direct-entry">
      <div className="lexicon-editor-item__heading lexicon-editor-item__heading--actions">
        <EditorOrderActions label={label} first={groupIndex === 0} last={groupIndex === entries.length - 1} onMove={direction => moveEntry(section, entries, groupIndex, direction)} onRemove={removeEntry}/>
      </div>
      <div className="lexicon-editor-item__content">{content}</div>
    </article>;
    return <article key={entry.id} data-editor-entry={entry.id} className="lexicon-editor-item">
      <div className="lexicon-editor-item__heading">
        <button type="button" className="lexicon-editor-item__toggle" aria-expanded={open} onClick={() => setOpenEditorEntries(previous => { const next = new Set(previous); if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id); return next; })}>
          <span className="lexicon-editor-item__copy"><strong>{heading.title}</strong>{heading.summary && <span>{heading.summary}</span>}</span>
          <ChevronDown className="usage-disclosure-chevron lexicon-editor-item__chevron" size={18} aria-hidden="true"/>
        </button>
        <div className="lexicon-editor-item__controls">
          <EditorOrderActions label={label} first={groupIndex === 0} last={groupIndex === entries.length - 1} onMove={direction => moveEntry(section, entries, groupIndex, direction)} onRemove={() => {
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
  const groupedEditorEntries = () => {
    if (!draft || !editing || editing === 'basic' || editing === 'usage') return null;
    const entries = draft.sections[editing];
    if (editing === 'examples' && entries.length) {
      const groups = new Map<string, LearningEntry[]>();
      entries.forEach(entry => { const key = exampleGroupIds[entry.id] || entry.id; groups.set(key, [...(groups.get(key) || []), entry]); });
      return [...groups].map(([key, members]) => {
        const summary = groupSenseExamples(members, draft.senses, vocab.partOfSpeech)[0];
        return <section className="lexicon-editor-group" key={key}>
          <div className="lexicon-editor-group-heading"><span>{partOfSpeechAbbreviation(summary?.pos)} {summary?.meaning || '未填写词义'} <small>({members.length})</small></span><button type="button" className="lexicon-link lexicon-inline-add" onClick={() => addEditorEntry('examples', members[0])}><Plus size={16}/>添加例句</button></div>
          {editorEntries(members, 'examples')}
        </section>;
      });
    }
    if (editing === 'derivatives' && entries.length) {
      const groups = new Map<string, LearningEntry[]>();
      entries.forEach(entry => { const base = entry.family?.base ?? vocab.term; groups.set(base, [...(groups.get(base) || []), entry]); });
      return [...groups].map(([base, members]) => <section className="lexicon-editor-group" key={members[0].id}>
        <div className="lexicon-editor-group-heading"><label>词族基础词<input value={base} placeholder="例如 considerate" maxLength={3000} onChange={event => {
          const ids = new Set(members.map(entry => entry.id));
          setEditorEntries('derivatives', current => current.map(entry => ids.has(entry.id) ? { ...entry, family: { ...entry.family, base: event.target.value, relation: entry.family?.relation || '' } } : entry));
        }}/></label><button type="button" className="lexicon-link lexicon-inline-add" onClick={() => addEditorEntry('derivatives', undefined, base)}><Plus size={16}/>添加派生词</button></div>
        {editorEntries(members, 'derivatives')}
      </section>);
    }
    return editorEntries(entries, editing);
  };
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
    {editing && draft && <form ref={formRef} className={`lexicon-editor${editing === 'usage' ? ' lexicon-editor--usage' : editing === 'basic' ? '' : ' lexicon-editor--detail'}`} onSubmit={event => { event.preventDefault(); save(); }}><p className="editor-draft-state" role="status">{dirty ? '有未保存的修改' : '内容尚未修改'}</p>{editing === 'basic' && <h3>编辑基本资料</h3>}
      {editing === 'basic' && <div className="lexicon-editor-fields"><label>英式音标（选填）<input placeholder="例如 /kənˈsɪd.ər.ət/" value={draft.phoneticUK} onChange={event => setDraft({ ...draft, phoneticUK: event.target.value })}/></label><label>美式音标（选填）<input placeholder="例如 /kənˈsɪd.ɚ.ət/" value={draft.phoneticUS} onChange={event => setDraft({ ...draft, phoneticUS: event.target.value })}/></label></div>}
      {editing === 'usage' ? <UsageEditor invalidEntryId={invalidEntryId} error={error} entries={draft.sections.usage} onChange={usage => setDraft(current => current ? { ...current, sections: { ...current.sections, usage: typeof usage === 'function' ? usage(current.sections.usage) : usage } } : current)}/> : editing === 'basic' ? editorEntries(draft.senses, 'basic') : <>
        <div className="lexicon-editor-toolbar lexicon-editor-toolbar--detail">
          <span>{sectionLabels[editing]} <small>({draft.sections[editing].length})</small></span>
          <div>
            {draft.sections[editing].length > 1 && ['examples', 'derivatives', 'phrases'].includes(editing) && <>
              <button type="button" className="lexicon-link" disabled={draft.sections[editing].every(entry => openEditorEntries.has(entry.id))} onClick={() => setOpenEditorEntries(new Set(draft.sections[editing].map(entry => entry.id)))}>展开本栏条目</button>
              <button type="button" className="lexicon-link" disabled={!openEditorEntries.size} onClick={() => setOpenEditorEntries(new Set())}>收起本栏条目</button>
            </>}
            {!(editing === 'roots' && draft.sections.roots.length) && <button type="button" className="lexicon-link lexicon-inline-add" onClick={() => addEditorEntry(editing)}><Plus size={16}/>{editing === 'roots' ? '添加构词部分' : editing === 'examples' && draft.sections.examples.length ? '添加其他词义例句' : editing === 'derivatives' && draft.sections.derivatives.length ? '添加其他词族' : `添加${editorLabels[editing]}`}</button>}
          </div>
        </div>
        <div className="lexicon-editor-item-list">{groupedEditorEntries()}</div>
      </>}
      {editing === 'basic' && <button type="button" className="lexicon-link" onClick={() => {
        const entry: LearningEntry = { id: crypto.randomUUID(), text: '', meaningZh: '' };
        setEditorEntries('basic', [...draft.senses, entry]);
      }}><Plus size={16}/>添加{editorLabels[editing]}</button>}
      {editing === 'basic' && (details.category || details.type) === 'word' && <fieldset className="lexicon-editor-inflections"><legend><span>适用的词形变化 <small>({draft.inflections.length})</small></span><button type="button" className="lexicon-link lexicon-inline-add" onClick={() => setDraft(current => current ? { ...current, inflections: [...current.inflections, { label: '', value: '' }] } : current)}><Plus size={16}/>添加</button></legend>{draft.inflections.map((form, index) => <div className="lexicon-form-row" key={`${form.label}:${form.value}:${index}`}><label>词形类型<input placeholder="例如 名词复数" value={form.label} onChange={event => setDraft(current => current ? { ...current, inflections: current.inflections.map((v, i) => i === index ? { ...v, label: event.target.value } : v) } : current)}/></label><label>变化后的英文<input placeholder="例如 conflicts" value={form.value} onChange={event => setDraft(current => current ? { ...current, inflections: current.inflections.map((v, i) => i === index ? { ...v, value: event.target.value } : v) } : current)}/></label><button type="button" aria-label={`删除词形 ${index+1}`} onClick={() => {
        setDraft(current => current ? { ...current, inflections: current.inflections.filter((_, i) => i !== index) } : current);
        recordEditorUndo(() => setDraft(current => current ? { ...current, inflections: [...current.inflections.slice(0, Math.min(index, current.inflections.length)), form, ...current.inflections.slice(Math.min(index, current.inflections.length))] } : current), '词形已删除');
      }}><Trash2 size={16}/></button></div>)}</fieldset>}
      <div className={`lexicon-actions${editing === 'usage' ? ' lexicon-actions--usage' : editing !== 'basic' ? ' lexicon-actions--detail' : ''}`}>
        <button type="button" disabled={busy} onClick={() => dirty ? setConfirmDiscard(true) : closeEditor()}>取消</button>
        <button type="submit" className="lexicon-primary" disabled={busy}>保存修改</button>
      </div>
    </form>}
    {confirmDiscard && <dialog ref={discardDialogRef} className="app-dialog lexicon-discard-dialog" aria-labelledby={`${discardDialogId}-title`} aria-describedby={`${discardDialogId}-description`} onCancel={event => { event.preventDefault(); event.stopPropagation(); setConfirmDiscard(false); }}>
      <h2 id={`${discardDialogId}-title`}>放弃尚未保存的修改？</h2>
      <p id={`${discardDialogId}-description`}>放弃后，本次编辑的内容将不会保存。</p>
      <div>
        <button type="button" onClick={closeEditor}>放弃修改</button>
        <button type="button" data-dialog-initial-focus onClick={() => setConfirmDiscard(false)}>继续编辑</button>
      </div>
    </dialog>}
    <EditorUndoNotice/>
    <LoadingAnimation active={busy} operation={details.generated ? 'wait' : loadingOperation} label="正在处理，请稍候…"/>{error && <div role="alert" className="wordbook-error"><p>{error}</p>{!details.generated && <button type="button" disabled={busy || !ready || !!editing} onClick={() => generate()}>重试生成资料</button>}</div>}{message && <p role="status" className="lexicon-muted">{message}</p>}
  </div>;
}
