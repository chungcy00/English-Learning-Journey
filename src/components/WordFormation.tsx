import React from 'react';
import { Plus, Volume2, X } from 'lucide-react';
import type { LearningEntry, WordFormation } from '../types';

const partLabels = { prefix: '前缀', root: '词根', suffix: '后缀' };
export function DerivativeList({ entries, pronounce }: { entries: LearningEntry[]; pronounce: (text: string) => void }) {
  const groups = new Map<string, LearningEntry[]>();
  for (const entry of entries) {
    const base = entry.family?.base || '';
    groups.set(base, [...(groups.get(base) || []), entry]);
  }
  return <div className="lexicon-families">{[...groups].map(([base, words]) => <section key={base} className="lexicon-family">
    {base && <h4>词族 · <span lang="en">{base}</span></h4>}
    <ul>{words.map(entry => <li key={entry.id} className="lexicon-derivative">
      <div className="lexicon-derivative-heading"><strong lang="en">{entry.text}</strong><button type="button" aria-label={`朗读：${entry.text}`} onClick={() => pronounce(entry.text)}><Volume2 size={18}/></button></div>
      <p><span className="lexicon-muted">{entry.partOfSpeech}</span>{entry.partOfSpeech && ' · '}{entry.meaningZh}</p>
      {entry.family?.relation && <p className="lexicon-muted">{entry.family.relation}</p>}
      {entry.example && <div className="lexicon-example"><button type="button" aria-label={`朗读例句：${entry.example}`} onClick={() => pronounce(entry.example!)}><Volume2 size={16}/></button><div><p lang="en">{entry.example}</p>{entry.exampleTranslation && <p className="lexicon-muted">{entry.exampleTranslation}</p>}</div></div>}
      {entry.note && <p className="lexicon-note">{entry.note}</p>}
    </li>)}</ul>
  </section>)}</div>;
}
export function RootAnalysis({ entry, term, pronounce }: { key?: string; entry: LearningEntry; term: string; pronounce: (text: string) => void }) {
  const m = entry.morphology;
  // Legacy prose remains available. Never infer new roots from spelling in the UI.
  if (!m || !Array.isArray(m.parts)) return <section className="lexicon-entry"><h4>{entry.text}</h4><p>{entry.meaningZh}</p>{entry.example && <p lang="en">{entry.example}</p>}{entry.exampleTranslation && <p className="lexicon-muted">{entry.exampleTranslation}</p>}{entry.note && <p className="lexicon-muted">{entry.note}</p>}</section>;
  const exact = m.parts.map(part => part.text).join('').toLowerCase() === term.toLowerCase();
  return <section className="lexicon-morphology">
    <h4 className="lexicon-core-root"><span lang="en">{m.root}</span><span>{m.meaningZh}</span></h4>
    <h5>真实构词分析</h5>
    <p className="lexicon-word-parts" lang="en" aria-label={`构词拆解：${m.parts.map(part => part.text).join(' + ')}`}>{m.parts.map((part, index) => <React.Fragment key={index}>{!exact && index > 0 && <span> + </span>}<span className={`lexicon-word-part lexicon-word-part--${part.kind}`}>{part.text}</span></React.Fragment>)}</p>
    <dl className="lexicon-part-meanings">{m.parts.map((part, index) => <div key={index}><dt><span className="lexicon-part-tag">{partLabels[part.kind]}</span><span lang="en" className={`lexicon-word-part--${part.kind}`}>{part.text}</span></dt><dd>{part.meaningZh}</dd></div>)}</dl>
    {m.explanation && <p className="lexicon-formation-explanation">{m.explanation}</p>}
    {m.mnemonic && <div className="lexicon-memory"><h5>辅助记忆联想</h5><p>{m.mnemonic}</p><small>联想仅帮助记忆，不代表真实词源。</small></div>}
    {!!m.related?.length && <div className="lexicon-root-related"><h5>同根词</h5><ul>{m.related.map((word, index) => <li key={index}><div className="lexicon-derivative-heading"><strong lang="en">{word.word}</strong><button type="button" aria-label={`朗读：${word.word}`} onClick={() => pronounce(word.word)}><Volume2 size={18}/></button></div><p><span className="lexicon-muted">{word.partOfSpeech}</span> · {word.meaningZh}</p></li>)}</ul></div>}
  </section>;
}
export function WordFormationEditor({ entry, onChange }: { entry: LearningEntry; onChange: (entry: LearningEntry) => void }) {
  const m: WordFormation = entry.morphology || { root: '', meaningZh: '', parts: [], explanation: '', mnemonic: '', related: [] };
  const patch = (value: Partial<WordFormation>) => onChange({ ...entry, morphology: { ...m, ...value } });
  return <div className="lexicon-formation-editor">
    <h4>真实构词分析</h4>
    {([['root', '核心词根'], ['meaningZh', '词根基本含义'], ['explanation', '构词含义说明'], ['mnemonic', '辅助记忆联想（不作为词源）']] as const).map(([key, label]) => <label key={key}>{label}<textarea rows={2} maxLength={3000} value={m[key]} onChange={event => patch({ [key]: event.target.value })}/></label>)}
    <h4>构词部分（按原词顺序）</h4>
    {m.parts.map((part, index) => <div className="lexicon-formation-editor-row" key={index}>
      <label>组成类型<select value={part.kind} onChange={event => patch({ parts: m.parts.map((v, i) => i === index ? { ...v, kind: event.target.value as typeof part.kind } : v) })}>{Object.entries(partLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {(['text','meaningZh'] as const).map(key => <label key={key}>{key === 'text' ? '原词中的拼写' : '部分含义'}<input maxLength={3000} value={part[key]} onChange={event => patch({ parts: m.parts.map((v,i) => i === index ? { ...v, [key]: event.target.value } : v) })}/></label>)}
      <button type="button" aria-label={`删除构词部分 ${index + 1}`} onClick={() => patch({ parts: m.parts.filter((_,i) => i !== index) })}><X size={16}/></button>
    </div>)}
    <button type="button" className="lexicon-link" onClick={() => patch({ parts: [...m.parts, { kind: 'root', text: '', meaningZh: '' }] })}><Plus size={16}/>添加构词部分</button>
    <h4>同根词</h4>
    {m.related.map((word,index) => <div className="lexicon-formation-editor-row" key={index}>{(['word','partOfSpeech','meaningZh'] as const).map((key,i) => <label key={key}>{['英文单词','词性','中文含义'][i]}<input maxLength={3000} value={word[key]} onChange={event => patch({ related: m.related.map((v,j) => j === index ? { ...v, [key]: event.target.value } : v) })}/></label>)}<button type="button" aria-label={`删除同根词 ${index + 1}`} onClick={() => patch({ related: m.related.filter((_,i) => i !== index) })}><X size={16}/></button></div>)}
    <button type="button" className="lexicon-link" onClick={() => patch({ related: [...m.related, { word:'', partOfSpeech:'', meaningZh:'' }] })}><Plus size={16}/>添加同根词</button>
  </div>;
}
