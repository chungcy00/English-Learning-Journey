import React, { useEffect, useRef, useState } from 'react';
import { PhraseList, UsageList, usageLabels } from './PhraseUsage';
import { DerivativeList, RootAnalysis, WordFormationEditor } from './WordFormation';
import { Bookmark, Plus, Volume2, X } from 'lucide-react';
import { DETAIL_SECTIONS, type DetailSection, type LearningEntry, type VocabularyDetails, type VocabularyItem } from '../types';
import { legacyDetails, sectionLabels, materialKey, categoryLabels, inflectionLabel } from '../utils/vocabularyDetails';
import { readVocabularyDetails, saveVocabularyDetails, generateVocabularyDetails, toggleMaterial } from '../services/vocabularyDetails';
import { db } from '../db/dexie';
import { speakEnglishTerm } from '../utils/speech';

export function VocabularyDetailsPanel({ vocab, onBeforePronunciation, onInteractionStateChange }: { key?: string; vocab: VocabularyItem; onBeforePronunciation?: () => void; onInteractionStateChange?: (busy: boolean) => void }) {
  const [details, setDetails] = useState<VocabularyDetails>(() => legacyDetails(vocab));
  const [tab, setTab] = useState<DetailSection>('examples');
  const [draft, setDraft] = useState<VocabularyDetails | null>(null);
  const [editing, setEditing] = useState<DetailSection | 'basic' | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const lock = useRef(false);
  const run = useRef(0);
  useEffect(() => { onInteractionStateChange?.(!!editing); }, [busy, editing, onInteractionStateChange]);
  useEffect(() => () => onInteractionStateChange?.(false), [onInteractionStateChange]);
  useEffect(() => {
    const id = ++run.current;
    setDetails(legacyDetails(vocab)); setDraft(null); setEditing(null); setConfirm(false); setError(''); setMessage(''); setReady(false); setTab('examples');
    readVocabularyDetails(vocab).then(value => { if (run.current === id) { setDetails(value); setReady(true); if (!value.generated) generate(); } }).catch(() => { if (run.current === id) setError('本地资料读取失败，请关闭后重试。'); });
    return () => { run.current++; };
  }, [vocab.id, vocab.term]);
  useEffect(() => {
    let active = true;
    const refresh = () => void db.savedMaterials.toArray().then(items => { if (active) setSavedKeys(new Set(items.map(item => item.key))); }).catch(() => { if (active) setError('收藏读取失败，请稍后重试。'); });
    refresh(); window.addEventListener('vocabulary-data-changed', refresh);
    return () => { active = false; window.removeEventListener('vocabulary-data-changed', refresh); };
  }, []);
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
    if (id === run.current) { setDetails(value); setConfirm(false); setMessage('资料已保存到本机，再次查看无需生成。'); }
  });
  const startEdit = (section: DetailSection | 'basic') => { const copy = structuredClone(details); copy.inflections = copy.inflections.map(form => ({ ...form, label: inflectionLabel(form.label) })); setDraft(copy); setEditing(section); setConfirm(false); setError(''); setMessage(''); };
  const save = () => void perform(async () => {
    if (!draft || !editing) return;
    const now = Date.now();
    const latest = await readVocabularyDetails(vocab);
    const next: VocabularyDetails = { ...latest, ...(editing === 'basic' ? { phoneticUK: draft.phoneticUK.trim(), phoneticUS: draft.phoneticUS.trim(), senses: draft.senses.filter(item => item.text.trim() || item.meaningZh.trim()), inflections: (details.category || details.type) === 'word' ? draft.inflections.filter(item => item.label.trim() && item.value.trim()) : [] } : {}),
      sections: { ...latest.sections, ...(editing !== 'basic' ? { [editing]: draft.sections[editing].map(item => editing === 'roots' && item.morphology?.root ? { ...item, text: item.text.trim() || item.morphology.root, meaningZh: item.meaningZh.trim() || item.morphology.meaningZh } : item).filter(item => item.text.trim()) } : {}) },
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
  const editorEntries = (entries: LearningEntry[]) => entries.map((entry, index) => <fieldset key={entry.id} className="lexicon-editor-entry"><legend>第 {index + 1} 项</legend>
    {(editing === 'basic' ? [['text', '义项简述'], ['meaningZh', '中文含义'], ['partOfSpeech', '词性'], ['example', '英文例句'], ['exampleTranslation', '例句翻译']] : editing === 'usage' ? [['text', '分析标题'], ['meaningZh', '中文解释'], ['example', '英文例句（按需）'], ['exampleTranslation', '例句翻译'], ['note', '补充说明']] : editing === 'phrases' ? [['text', '完整英文词组'], ['meaningZh', '中文意思'], ['example', '英文例句（按需）'], ['exampleTranslation', '例句翻译'], ['note', '补充说明']] : [['text', tab === 'examples' ? '英文例句' : tab === 'definitions' ? '英文定义' : '内容'], ['meaningZh', '中文含义／翻译'], ['partOfSpeech', '词性'], ['category', '类别'], ['example', '补充例句'], ['exampleTranslation', '补充例句翻译'], ['note', '用法说明']]).map(([field, label]) => <label key={field}>{label}<textarea rows={field === 'text' ? 2 : 1} maxLength={3000} value={typeof entry[field as keyof LearningEntry] === 'string' ? entry[field as keyof LearningEntry] as string : ''} onChange={event => patchEntry(index, field as keyof LearningEntry, event.target.value)} /></label>)}
    {editing === 'usage' && <><label>分析方向<select value={entry.usageKind || ''} onChange={event => {
      if (!draft) return;
      const kind = event.target.value as LearningEntry['usageKind'];
      setDraft({ ...draft, sections: { ...draft.sections, usage: draft.sections.usage.map((v,i) => i === index ? { ...v, usageKind: kind || undefined, contrast: kind === 'error' ? v.contrast : undefined } : v) } });
    }}><option value="">未分类</option>{Object.entries(usageLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {entry.usageKind === 'error' && <>{(['incorrect','correct'] as const).map(key => <label key={key}>{key === 'incorrect' ? '误用表达（确有错误时填写）' : '正确表达'}<textarea value={entry.contrast?.[key] || ''} onChange={event => patchEntry(index, 'contrast', { incorrect: entry.contrast?.incorrect || '', correct: entry.contrast?.correct || '', [key]: event.target.value })}/></label>)}</>}
    </>}
    {editing === 'derivatives' && <><label>词族基本词<input value={entry.family?.base || ''} onChange={event => patchEntry(index, 'family', { base: event.target.value, relation: entry.family?.relation || '' })}/></label><label>真实派生关系<textarea value={entry.family?.relation || ''} onChange={event => patchEntry(index, 'family', { base: entry.family?.base || '', relation: event.target.value })}/></label></>}
    {editing === 'roots' && <WordFormationEditor entry={entry} onChange={next => patchEntry(index, 'morphology', next.morphology)}/>}
    <button type="button" className="lexicon-link" onClick={() => {
      if (!draft || !editing) return;
      const next = entries.filter((_, i) => i !== index);
      setDraft(editing === 'basic' ? { ...draft, senses: next } : { ...draft, sections: { ...draft.sections, [editing]: next } });
    }}>删除此项</button>
  </fieldset>);
  return <div className="lexicon-panel" aria-busy={busy}>
    <div className="lexicon-basic">
      <p className="lexicon-kind">{category ? `${categoryLabels[category]} · ${category === 'phrasal-verb' ? 'phrasal verb' : category}` : details.generated ? `${categoryLabels[details.type] || '词条'} · ${details.type}` : '多词表达 · 生成时自动细分类型'}</p>
      <div className="lexicon-pronunciations">{([['en-GB', '英', details.phoneticUK], ['en-US', '美', details.phoneticUS]] as const).map(([lang, label, ipa]) => <button key={lang} type="button" onClick={() => pronounce(vocab.term, lang)} aria-label={`${label}式发音：${vocab.term}`}><Volume2 size={17} aria-hidden="true"/>{label}{ipa && <span>{ipa}</span>}</button>)}<button type="button" className="lexicon-link" disabled={!ready || busy || !!editing} onClick={() => startEdit('basic')}>编辑基本资料</button></div>
      {!!details.senses.length ? details.senses.map(sense => <div key={sense.id} className="lexicon-sense"><span>{sense.partOfSpeech}</span><p>{sense.meaningZh || sense.text}</p>{sense.example && <><p lang="en">{sense.example}</p>{sense.exampleTranslation && <p className="lexicon-muted">{sense.exampleTranslation}</p>}</>}</div>) : <p className="lexicon-muted">尚未填写释义，可手动编辑或生成详细资料。</p>}
      {(details.category || details.type) === 'word' && !!details.inflections.length && <dl className="lexicon-inflections">{details.inflections.map((form, i) => <div key={i}><dt>{inflectionLabel(form.label)}</dt><dd>{form.value}</dd></div>)}</dl>}
      <p className="lexicon-source">来源：{vocab.sourceReadingId ? '阅读短文' : '手动添加'} · {details.provenance.basic?.source === 'user' ? '基本资料已手动编辑' : details.generated ? 'AI 生成，可编辑更正' : '已有基础资料'}</p>
    </div>
    <div className="lexicon-tabs" role="tablist" aria-label="词汇资料栏目">{DETAIL_SECTIONS.map((key, index) => <button type="button" key={key} id={`lexicon-tab-${vocab.id}-${key}`} role="tab" aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} aria-controls={`lexicon-content-${vocab.id}`} disabled={!!editing} onClick={() => { setTab(key); setConfirm(false); setMessage(''); }} onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 5 : (index + (event.key === 'ArrowRight' ? 1 : 5)) % 6; setTab(DETAIL_SECTIONS[next]); setConfirm(false); const row = event.currentTarget.parentElement;
        const target = row?.children[next] as HTMLButtonElement | undefined;
        target?.focus({ preventScroll: true });
        if (row && target) { const bounds = row.getBoundingClientRect(); const button = target.getBoundingClientRect(); row.scrollLeft += button.left < bounds.left ? button.left - bounds.left : button.right > bounds.right ? button.right - bounds.right : 0; } }
    }}><span className="lexicon-tab-label">{sectionLabels[key]}</span></button>)}</div>
    {!editing && <div id={`lexicon-content-${vocab.id}`} role="tabpanel" tabIndex={0} aria-labelledby={`lexicon-tab-${vocab.id}-${tab}`} className="lexicon-content">
      <div className="lexicon-section-tools"><span className="lexicon-muted">{details.provenance[tab] ? `${details.provenance[tab]!.source === 'user' ? '手动编辑' : 'AI 生成'} · ${new Date(details.provenance[tab]!.updatedAt).toLocaleDateString('zh-CN')}` : '基础资料'}</span><button type="button" disabled={!ready || busy} onClick={() => startEdit(tab)}>编辑本栏</button><button type="button" disabled={!ready || busy} onClick={() => setConfirm(value => !value)}>重新生成本栏</button></div>
      {(tab === 'roots' || tab === 'derivatives') && items.some(entry => tab === 'roots' ? !entry.morphology : !entry.family) && <p className="lexicon-muted" role="status">{tab === 'roots' ? '当前资料尚未包含构词拆解，可编辑或重新生成本栏。' : '当前资料尚未包含词族关系，可编辑或重新生成本栏。'}</p>}
      {confirm && <div className="lexicon-confirm"><p>将调用 AI 替换「{sectionLabels[tab]}」的内容{details.provenance[tab]?.source === 'user' ? '，包括本栏的手动修改' : ''}。其他栏目、独立收藏和复习进度保留。</p><button type="button" disabled={busy} onClick={() => generate(tab, true)}>确认替换本栏</button><button type="button" disabled={busy} onClick={() => setConfirm(false)}>取消</button></div>}
      {items.length ? tab === 'phrases' ? <PhraseList entries={items} busy={busy} isSaved={text => savedKeys.has(materialKey('phrase', text))} pronounce={pronounce} onToggle={entry => void perform(async () => { await toggleMaterial(vocab, 'phrases', entry); })}/> : tab === 'usage' ? <UsageList entries={items} pronounce={pronounce}/> : tab === 'derivatives' ? <DerivativeList entries={items} pronounce={pronounce}/> : tab === 'roots' ? items.map(entry => <RootAnalysis key={entry.id} entry={entry} term={vocab.term} pronounce={pronounce}/>) : items.map(entry => <section key={entry.id} className="lexicon-entry">
        <div className="lexicon-entry-heading"><div>{entry.category && <span className="lexicon-muted">{entry.category}</span>}{entry.senseId && details.senses.find(sense => sense.id === entry.senseId) && <span className="lexicon-muted">{details.senses.find(sense => sense.id === entry.senseId)?.meaningZh}</span>}<p lang={tab === 'roots' || tab === 'usage' ? undefined : 'en'}>{entry.partOfSpeech && <span className="lexicon-muted">{entry.partOfSpeech} </span>}{entry.text}</p></div>
          <div className="lexicon-entry-actions">{tab !== 'roots' && tab !== 'usage' && <button type="button" aria-label={`朗读：${entry.text}`} onClick={() => pronounce(entry.text)}><Volume2 size={18}/></button>}{(tab === 'examples' || tab === 'phrases') && <button type="button" disabled={busy} aria-label={`${savedKeys.has(materialKey(tab === 'examples' ? 'example' : 'phrase', entry.text)) ? '取消' : ''}收藏：${entry.text}`} aria-pressed={savedKeys.has(materialKey(tab === 'examples' ? 'example' : 'phrase', entry.text))} onClick={() => void perform(async () => { await toggleMaterial(vocab, tab, entry); })}><Bookmark size={18} fill={savedKeys.has(materialKey(tab === 'examples' ? 'example' : 'phrase', entry.text)) ? 'currentColor' : 'none'}/></button>}</div>
        </div>
        {entry.meaningZh && <p className="lexicon-muted">{entry.meaningZh}</p>}{entry.example && <div className="lexicon-example"><button type="button" aria-label={`朗读例句：${entry.example}`} onClick={() => pronounce(entry.example!)}><Volume2 size={16}/></button><div><p lang="en">{entry.example}</p>{entry.exampleTranslation && <p className="lexicon-muted">{entry.exampleTranslation}</p>}</div></div>}{entry.note && <p className="lexicon-note">{entry.note}</p>}
      </section>) : <p className="lexicon-empty">{details.generatedSections?.includes(tab) ? tab === 'derivatives' ? '暂无常见且可靠的派生词。' : tab === 'roots' ? '暂无可靠且适用的构词拆解。' : '暂无可靠或适用的内容，可手动补充。' : '本栏尚未生成，可先使用已有资料或手动填写。'}</p>}
    </div>}
    {editing && draft && <form className="lexicon-editor" onSubmit={event => { event.preventDefault(); save(); }}><h3>编辑{editing === 'basic' ? '基本资料' : sectionLabels[editing]}</h3>
      {editing === 'basic' && <><label>英式音标<input value={draft.phoneticUK} onChange={event => setDraft({ ...draft, phoneticUK: event.target.value })}/></label><label>美式音标<input value={draft.phoneticUS} onChange={event => setDraft({ ...draft, phoneticUS: event.target.value })}/></label></>}
      {editorEntries(editing === 'basic' ? draft.senses : draft.sections[editing])}
      <button type="button" className="lexicon-link" onClick={() => {
        const entry: LearningEntry = { id: crypto.randomUUID(), text: '', meaningZh: '' };
        setDraft(editing === 'basic' ? { ...draft, senses: [...draft.senses, entry] } : { ...draft, sections: { ...draft.sections, [editing]: [...draft.sections[editing], entry] } });
      }}><Plus size={16}/>添加{editing === 'basic' ? '义项' : '一项'}</button>
      {editing === 'basic' && (details.category || details.type) === 'word' && <fieldset><legend>适用的词形变化</legend>{draft.inflections.map((form, index) => <div className="lexicon-form-row" key={index}><label>变化名称<input value={form.label} onChange={event => setDraft({ ...draft, inflections: draft.inflections.map((v, i) => i === index ? { ...v, label: event.target.value } : v) })}/></label><label>词形<input value={form.value} onChange={event => setDraft({ ...draft, inflections: draft.inflections.map((v, i) => i === index ? { ...v, value: event.target.value } : v) })}/></label><button type="button" aria-label="删除词形" onClick={() => setDraft({ ...draft, inflections: draft.inflections.filter((_, i) => i !== index) })}><X size={16}/></button></div>)}<button type="button" onClick={() => setDraft({ ...draft, inflections: [...draft.inflections, { label: '', value: '' }] })}>添加词形</button></fieldset>}
      <div className="lexicon-actions"><button type="submit" className="lexicon-primary" disabled={busy}>保存修改</button><button type="button" disabled={busy} onClick={() => { setDraft(null); setEditing(null); }}>取消</button></div>
    </form>}
    {busy && <p role="status" className="lexicon-muted">正在处理，请稍候…</p>}{error && <div role="alert" className="wordbook-error"><p>{error}</p>{!details.generated && <button type="button" disabled={busy || !ready || !!editing} onClick={() => generate()}>重试生成资料</button>}</div>}{message && <p role="status" className="lexicon-muted">{message}</p>}
  </div>;
}
