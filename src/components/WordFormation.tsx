import React from 'react';
import { Plus, Volume2, X } from 'lucide-react';
import type { LearningEntry, WordFormation, WordPart } from '../types';
import { familyForest, hasExactParts, partOfSpeechAbbreviation, type FamilyNode } from '../utils/wordFormation';

const partLabels = { prefix: '前缀', root: '词根', suffix: '后缀' };
export function HighlightedWord({word,parts}:{word:string;parts?:WordPart[]}) {
  return <span lang="en">{hasExactParts(parts,word) ? parts.map((part,index)=><span key={index} className={`lexicon-word-part--${part.kind}`}>{part.text}</span>) : word}</span>;
}
export function DerivativeList({ entries, term = '', pronounce }: { entries: LearningEntry[]; term?: string; pronounce: (text: string) => void }) {
  const renderNode = ({entry,children}:FamilyNode) => <li key={entry.id} className="lexicon-tree-node">
    <div className="lexicon-derivative-heading"><strong><HighlightedWord word={entry.text} parts={entry.family?.parts}/></strong><button type="button" aria-label={`朗读：${entry.text}`} onClick={()=>pronounce(entry.text)}><Volume2 size={18}/></button></div>
    <p className="lexicon-family-meaning"><span className="lexicon-pos">{partOfSpeechAbbreviation(entry.partOfSpeech)}</span>{entry.meaningZh}</p>
    {entry.family?.relation && <p className="lexicon-family-relation">{entry.family.relation}</p>}
    {entry.note && <p className="lexicon-note">{entry.note}</p>}
    {children.length>0 && <ul className="lexicon-tree-list">{children.map(renderNode)}</ul>}
  </li>;
  return <section className="lexicon-tree-card lexicon-families">
    <div className="lexicon-family-origin"><strong lang="en">{term || entries[0]?.family?.base}</strong></div>
    <ul className="lexicon-tree-list">{familyForest(entries).map(renderNode)}</ul>
  </section>;
}
export function RootAnalysis({ entry, term, pronounce }: { key?: string; entry: LearningEntry; term: string; pronounce: (text: string) => void }) {
  const m = entry.morphology;
  if (!m || !hasExactParts(m.parts,term)) return <section className="lexicon-root-legacy"><h4>{entry.text}</h4><p>{entry.meaningZh}</p>{entry.example&&<p lang="en">{entry.example}</p>}{entry.exampleTranslation&&<p className="lexicon-muted">{entry.exampleTranslation}</p>}{entry.note&&<p className="lexicon-muted">{entry.note}</p>}</section>;
  return <section className="lexicon-tree-card lexicon-root-map">
    <h4 className="lexicon-core-root"><span lang="en">{m.root}</span><span>{m.meaningZh}</span></h4>
    <div className="lexicon-root-analysis">
      <h5>真实构词分析</h5>
      <p className="lexicon-word-parts" aria-label={`构词拆解：${m.parts.map(part=>part.text).join(' + ')}`}><HighlightedWord word={term} parts={m.parts}/></p>
      <dl className="lexicon-part-meanings">{m.parts.map((part,index)=><div key={index}><dt><span className="lexicon-part-tag">{partLabels[part.kind]}</span><span lang="en" className={`lexicon-word-part--${part.kind}`}>{part.text}</span></dt><dd>{part.meaningZh}</dd></div>)}</dl>
      {m.explanation&&<p className="lexicon-formation-explanation">{m.explanation}</p>}
    </div>
    {m.mnemonic&&<div className="lexicon-memory"><h5>辅助记忆联想</h5><p>{m.mnemonic}</p><small>联想仅帮助记忆，不代表真实词源。</small></div>}
    {!!m.related?.length&&<div className="lexicon-root-related"><h5>同根词</h5><ul className="lexicon-tree-list">{m.related.map((word,index)=><li key={index} className="lexicon-tree-node lexicon-related-node">
      <details><summary><HighlightedWord word={word.word} parts={word.parts}/></summary><div className="lexicon-related-content"><p><span className="lexicon-pos">{partOfSpeechAbbreviation(word.partOfSpeech)}</span>{word.meaningZh}</p>{word.relation&&<p className="lexicon-family-relation">{word.relation}</p>}</div></details>
      <button type="button" aria-label={`朗读：${word.word}`} onClick={()=>pronounce(word.word)}><Volume2 size={18}/></button>
    </li>)}</ul></div>}
  </section>;
}
export function WordPartsEditor({parts,onChange}:{parts:WordPart[];onChange:(parts:WordPart[])=>void}) {
  return <div className="lexicon-parts-editor">{parts.map((part,index)=><div className="lexicon-formation-editor-row" key={index}>
    <label>组成类型<select value={part.kind} onChange={event=>onChange(parts.map((v,i)=>i===index?{...v,kind:event.target.value as WordPart['kind']}:v))}>{Object.entries(partLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {(['text','meaningZh'] as const).map(key=><label key={key}>{key==='text'?'单词中的拼写':'部分含义'}<input maxLength={3000} value={part[key]} onChange={event=>onChange(parts.map((v,i)=>i===index?{...v,[key]:event.target.value}:v))}/></label>)}
    <button type="button" aria-label={`删除构词部分 ${index+1}`} onClick={()=>onChange(parts.filter((_,i)=>i!==index))}><X size={16}/></button>
  </div>)}<button type="button" className="lexicon-link" onClick={()=>onChange([...parts,{kind:'root',text:'',meaningZh:''}])}><Plus size={16}/>添加构词部分</button></div>;
}
export function DerivativeFamilyEditor({entry,onChange}:{entry:LearningEntry;onChange:(family:NonNullable<LearningEntry['family']>)=>void}) {
  const family=entry.family || {base:'',relation:''};
  return <div className="lexicon-formation-editor">{([['base','词族基本词'],['parent','直接派生自（不确定可留空）'],['relation','真实派生关系']] as const).map(([key,label])=><label key={key}>{label}<input maxLength={3000} value={family[key]||''} onChange={event=>onChange({...family,[key]:event.target.value})}/></label>)}<h4>派生词构词部分（有可靠拆解时填写）</h4><WordPartsEditor parts={family.parts||[]} onChange={parts=>onChange({...family,parts})}/></div>;
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
    {m.related.map((word,index) => <div className="lexicon-formation-editor-row" key={index}>{(['word','partOfSpeech','meaningZh','relation'] as const).map((key,i) => <label key={key}>{['英文单词','词性','中文含义','同根构词关系（不确定可留空）'][i]}<input maxLength={3000} value={word[key] || ''} onChange={event => patch({ related: m.related.map((v,j) => j === index ? { ...v, [key]: event.target.value } : v) })}/></label>)}<WordPartsEditor parts={word.parts || []} onChange={parts => patch({ related: m.related.map((v,j) => j === index ? { ...v, parts } : v) })}/><button type="button" aria-label={`删除同根词 ${index + 1}`} onClick={() => patch({ related: m.related.filter((_,i) => i !== index) })}><X size={16}/></button></div>)}
    <button type="button" className="lexicon-link" onClick={() => patch({ related: [...m.related, { word:'', partOfSpeech:'', meaningZh:'' }] })}><Plus size={16}/>添加同根词</button>
  </div>;
}
