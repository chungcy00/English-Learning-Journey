import { HandOutline, StudyEmptyState } from './LearningArt';
import React, { useState } from 'react';
import { Plus, Volume2, X } from 'lucide-react';
import type { LearningEntry, WordFormation, WordPart } from '../types';
import { derivativeDiagramBase, familyForest, hasExactParts, hasMatchingRoot, hasTransparentDerivation, practicalFormationText, partOfSpeechAbbreviation, verifiedWordFamilyRelation, type FamilyNode } from '../utils/wordFormation';

const partLabels = { prefix: '前缀', root: '词根', suffix: '后缀' };
export function HighlightedWord({word,parts}:{word:string;parts?:WordPart[]}) {
  return <span lang="en">{hasExactParts(parts,word) ? parts.map((part,index)=><span key={index} className={`lexicon-word-part--${part.kind}`}>{part.text}</span>) : word}</span>;
}
type Relation = '共同词根' | '词族关联';

function addsFamilyInformation(entry: LearningEntry, relation: string) {
  const text = relation.trim();
  const glosses = entry.meaningZh.split(/[；;、，,]/).map(gloss => gloss.trim()).filter(Boolean);
  if (glosses.includes(text.replace(/[。.]$/, ''))) return false;
  const rest = text.toLowerCase().startsWith(entry.text.toLowerCase()) ? text.slice(entry.text.length).trim() : text;
  const definition = rest.match(/^是表示[「“『](.+?)[」”』]的(名词|形容词|动词|副词)[。.]?$/);
  return !definition || !glosses.includes(definition[1])
    || partOfSpeechAbbreviation(definition[2]) !== partOfSpeechAbbreviation(entry.partOfSpeech);
}

function FamilyDetails({ entry, pronounce }: { entry: LearningEntry; pronounce: (text: string) => void }) {
  const relation = practicalFormationText(entry.family?.relation);
  const note = practicalFormationText(entry.note);
  return <>
    <div className="lexicon-derivative-heading">
      <div>
        <strong><HighlightedWord word={entry.text} parts={entry.family?.parts}/></strong>
        <p className="lexicon-family-meaning"><span className="lexicon-pos">{partOfSpeechAbbreviation(entry.partOfSpeech)}</span>{entry.meaningZh}</p>
      </div>
      <button type="button" aria-label={`朗读：${entry.text}`} onClick={() => pronounce(entry.text)}><Volume2 size={18}/></button>
    </div>
    {relation && addsFamilyInformation(entry, relation) && <p className="lexicon-family-relation">{relation}</p>}
    {note && <p className="lexicon-note">{note}</p>}
    {entry.example && <p lang="en">{entry.example}</p>}
    {entry.exampleTranslation && <p className="lexicon-muted">{entry.exampleTranslation}</p>}
  </>;
}

function FamilyDiagram({ base, entries, nodes, relation, pronounce }: {
  base: string; entries: LearningEntry[]; nodes: FamilyNode[]; relation: Relation; pronounce: (text: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(entries[0].id);
  const selected = entries.find(entry => entry.id === selectedId) ?? entries[0];
  const renderBranches = (branches: FamilyNode[], parent: string) => <ul className="lexicon-family-branches">
    {branches.map(({ entry, children }) => {
      const direct = entry.family?.parent?.trim().toLowerCase() === parent.trim().toLowerCase();
      const label = direct ? '直接派生' : relation;
      return <li key={entry.id} className="lexicon-family-branch" data-direct={direct}>
        <button type="button" className="lexicon-family-node" aria-pressed={selected.id === entry.id} aria-description={label}
          onClick={() => setSelectedId(entry.id)}>
          <HandOutline/>
          <HighlightedWord word={entry.text} parts={entry.family?.parts}/>
        </button>
        {children.length > 0 && renderBranches(children, entry.text)}
      </li>;
    })}
  </ul>;
  return <div className="lexicon-family-diagram">
    <div className="lexicon-family-viewport">
      <div className="lexicon-family-tree">
        <div className="lexicon-family-base" lang="en"><HandOutline/>{base}</div>
        {renderBranches(nodes, base)}
      </div>
    </div>
    <div className="lexicon-family-detail" aria-live="polite">
      <HandOutline/>
      <FamilyDetails entry={selected} pronounce={pronounce}/>
    </div>
  </div>;
}

export function DerivativeList({ entries, term = '', inflections = [], pronounce }: {
  entries: LearningEntry[]; term?: string; inflections?: string[]; pronounce: (text: string) => void;
}) {
  if (!entries.length) return null;
  const normalizedTerm = term.trim().toLowerCase();
  const hasRootless = entries.some(entry => entry.text.trim().toLowerCase() === 'rootless');
  const hasIncapacity = entries.some(entry => entry.text.trim().toLowerCase() === 'incapacity');
  const verified = new Map(entries.flatMap<readonly [string, NonNullable<LearningEntry['family']>]>(entry => {
    const word = entry.text.trim().toLowerCase();
    if (normalizedTerm === 'rooted' || normalizedTerm === 'root') {
      if (word === 'rootless') return [[entry.id, { base: 'root', parent: 'root', relation: 'root 加 -less，表示无根或没有归属感。' }] as const];
      if (word === 'rootlessly') return [[entry.id, { base: 'root', parent: hasRootless ? 'rootless' : undefined, relation: 'rootless 加 -ly，构成副词。' }] as const];
    }
    if (normalizedTerm === 'capacity') {
      if (word === 'incapacity') return [[entry.id, { base: 'capacity', parent: undefined, relation: '与 capacity 属于同一词族，表示缺乏能力。' }] as const];
      if (word === 'incapacitate') return [[entry.id, { base: 'capacity', parent: hasIncapacity ? 'incapacity' : undefined, relation: '由 incapacity 构成的动词，表示使人失去行动或做事的能力。' }] as const];
    }
    const relation = verifiedWordFamilyRelation(term, entry.text);
    return relation ? [[entry.id, {
      base: term.trim(),
      parent: normalizedTerm === 'considerate' ? term.trim() : undefined,
      relation,
    }] as const] : [];
  }));
  const base = verified.values().next().value?.base ?? derivativeDiagramBase(entries, term, inflections) ?? term.trim();
  const excluded = new Set([term, base, ...inflections].map(word => word.trim().toLowerCase()));
  const supported = entries.filter(entry => {
    if (excluded.has(entry.text.trim().toLowerCase())) return false;
    if (verified.has(entry.id)) return true;
    const parent = entry.family?.parent || base;
    return parent && hasTransparentDerivation(parent, entry.text, entry.family?.parts);
  });
  const candidates = supported.map(entry => {
    const family = verified.get(entry.id);
    return family ? { ...entry, family: { ...entry.family, ...family } } : entry;
  });
  const connected = new Set([base?.toLowerCase()]);
  for (let pass = 0; pass < candidates.length; pass++) {
    for (const entry of candidates) {
      if (connected.has((entry.family?.parent || base)?.trim().toLowerCase())) connected.add(entry.text.trim().toLowerCase());
    }
  }
  const diagramEntries = candidates.filter(entry => connected.has(entry.text.trim().toLowerCase()));
  if (!base || !diagramEntries.length) return <StudyEmptyState compact pose="hamster-reading">
    <p className="lexicon-empty">暂无常见且可靠的派生词。</p>
  </StudyEmptyState>;

  return <section className="lexicon-tree-card lexicon-families">
    <FamilyDiagram base={base} entries={diagramEntries} nodes={familyForest(diagramEntries)} relation="词族关联" pronounce={pronounce}/>
  </section>;
}
export function RootAnalysis({ entry, term, pronounce }: { key?: string; entry: LearningEntry; term: string; pronounce: (text: string) => void }) {
  const m = entry.morphology;
  const explanation = practicalFormationText(m?.explanation);
  const mnemonic = practicalFormationText(m?.mnemonic);
  if (!m || !hasExactParts(m.parts, term)) {
    const heading = practicalFormationText(entry.text);
    const meaning = practicalFormationText(entry.meaningZh);
    const note = practicalFormationText(entry.note);
    if (!meaning && !note && !entry.example) return null;
    return <section className="lexicon-root-legacy">
      {heading && <h4>{heading}</h4>}
      {meaning && <p>{meaning}</p>}
      {entry.example && <p lang="en">{entry.example}</p>}
      {entry.exampleTranslation && <p className="lexicon-muted">{entry.exampleTranslation}</p>}
      {note && <p className="lexicon-muted">{note}</p>}
    </section>;
  }
  const root = practicalFormationText(m.root);
  const meaning = practicalFormationText(m.meaningZh);
  const rootIndex = m.parts.findIndex(part => part.kind === 'root' && part.text.trim().toLowerCase() === root.toLowerCase());
  const parts = m.parts.map((part, index) => {
    const partMeaning = practicalFormationText(part.meaningZh);
    if (index !== rootIndex || !meaning) return { ...part, meaningZh: partMeaning };
    const glosses = [partMeaning, meaning].flatMap(gloss => gloss.split(/[，、；,;]/).map(text => text.trim()).filter(Boolean));
    return { ...part, meaningZh: [...new Set(glosses)].join('、') };
  });
  const hasBreakdown = parts.some(part => part.meaningZh);
  const hasSeparateRootMeaning = root && meaning && rootIndex < 0;
  if (!hasSeparateRootMeaning && !hasBreakdown && !explanation && !mnemonic) return null;
  return <section className="lexicon-tree-card lexicon-root-map">
    {hasSeparateRootMeaning && <h4 className="lexicon-core-root"><span lang="en">{root}</span><span>{meaning}</span></h4>}
    {(hasBreakdown || explanation) && <div className="lexicon-root-analysis">
      {hasBreakdown && <dl className="lexicon-part-meanings">{parts.filter(part => part.meaningZh).map((part,index)=><div key={index}><dt><span className="lexicon-part-tag">{partLabels[part.kind]}</span><span lang="en" className={`lexicon-word-part--${part.kind}`}>{part.text}</span></dt><dd>{part.meaningZh}</dd></div>)}</dl>}
      {explanation&&<p className="lexicon-formation-explanation">{explanation}</p>}
    </div>}
    {mnemonic&&<div className="lexicon-memory"><h5>辅助记忆联想</h5><p>{mnemonic}</p><small>联想仅帮助记忆，不代表真实词源。</small></div>}
    {!!m.related?.length && <RootFamily term={term} parts={m.parts} words={m.related} pronounce={pronounce}/>}
  </section>;
}
function RootFamily({ term, parts, words, pronounce }: {
  term: string; parts: WordPart[]; words: WordFormation['related']; pronounce: (text: string) => void;
}) {
  const matching: LearningEntry[] = [];
  const seen = new Set([term.trim().toLowerCase()]);
  for (const word of words) {
    const key = word?.word?.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const entry: LearningEntry = { id: key, text: word.word, partOfSpeech: word.partOfSpeech, meaningZh: word.meaningZh };
    if (hasMatchingRoot(term, parts, word.word, word.parts)) {
      matching.push({ ...entry, family: { base: term, relation: practicalFormationText(word.relation), parts: word.parts } });
    }
  }
  if (!matching.length) return null;
  return <div className="lexicon-root-related">
    <h5>同根词</h5>
    <FamilyDiagram base={term} entries={matching} nodes={familyForest(matching)} relation="共同词根" pronounce={pronounce}/>
  </div>;
}

export function WordPartsEditor({parts,onChange}:{parts:WordPart[];onChange:(parts:WordPart[])=>void}) {
  return <div className="lexicon-parts-editor">{parts.map((part,index)=><div className="lexicon-formation-editor-row" key={index}>
    <label>前缀、词根或后缀<select value={part.kind} onChange={event=>onChange(parts.map((v,i)=>i===index?{...v,kind:event.target.value as WordPart['kind']}:v))}>{Object.entries(partLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {(['text','meaningZh'] as const).map(key=><label key={key}>{key==='text'?'在单词中的拼写':'这部分的中文含义'}<input maxLength={3000} value={part[key]} onChange={event=>onChange(parts.map((v,i)=>i===index?{...v,[key]:event.target.value}:v))}/></label>)}
    <button type="button" aria-label={`删除构词部分 ${index+1}`} onClick={()=>onChange(parts.filter((_,i)=>i!==index))}><X size={16}/></button>
  </div>)}<button type="button" className="lexicon-link" onClick={()=>onChange([...parts,{kind:'root',text:'',meaningZh:''}])}><Plus size={16}/>添加构词部分</button></div>;
}
export function DerivativeFamilyEditor({entry,onChange}:{entry:LearningEntry;onChange:(family:NonNullable<LearningEntry['family']>)=>void}) {
  const family=entry.family || {base:'',relation:''};
  return <details className="lexicon-editor-optional"><summary>派生关系与构词（选填）</summary>
    <div className="lexicon-formation-editor">
      {([['base','词族的基础词','例如 considerate'],['parent','直接派生自哪个词','例如 considerate；不确定可留空'],['relation','构词说明','例如加 -ly 变成副词']] as const).map(([key,label,placeholder])=><label key={key}>{label}<input placeholder={placeholder} maxLength={3000} value={family[key]||''} onChange={event=>onChange({...family,[key]:event.target.value})}/></label>)}
      <WordPartsEditor parts={family.parts||[]} onChange={parts=>onChange({...family,parts})}/>
    </div>
  </details>;
}
export function WordFormationEditor({ entry, onChange }: { entry: LearningEntry; onChange: (entry: LearningEntry) => void }) {
  const m: WordFormation = { root: '', meaningZh: '', explanation: '', mnemonic: '', ...entry.morphology, parts: entry.morphology?.parts ?? [], related: entry.morphology?.related ?? [] };
  const patch = (value: Partial<WordFormation>) => onChange({ ...entry, morphology: { ...m, ...value } });
  return <div className="lexicon-formation-editor">
    {([['root', '核心词根的拼写（选填）'], ['meaningZh', '词根的中文含义（选填）'], ['explanation', '各部分怎样组成词义（选填）'], ['mnemonic', '助记联想（选填）']] as const).map(([key, label]) => <label key={key}>{label}<textarea rows={2} maxLength={3000} value={m[key]} onChange={event => patch({ [key]: event.target.value })}/></label>)}
    <h4>构词部分（按原词顺序）</h4>
    <p className="lexicon-muted">按拼写顺序添加各部分，合起来应是完整单词。</p>
    <WordPartsEditor parts={m.parts} onChange={parts => patch({ parts })}/>
    <details className="lexicon-editor-optional"><summary>同根词（选填）</summary>
    {m.related.map((word,index) => <div className="lexicon-formation-editor-row" key={index}>{(['word','partOfSpeech','meaningZh','relation'] as const).map((key,i) => <label key={key}>{['英文单词','词性','中文含义','同根构词关系（不确定可留空）'][i]}<input maxLength={3000} value={word[key] || ''} onChange={event => patch({ related: m.related.map((v,j) => j === index ? { ...v, [key]: event.target.value } : v) })}/></label>)}<WordPartsEditor parts={word.parts || []} onChange={parts => patch({ related: m.related.map((v,j) => j === index ? { ...v, parts } : v) })}/><button type="button" aria-label={`删除同根词 ${index + 1}`} onClick={() => patch({ related: m.related.filter((_,i) => i !== index) })}><X size={16}/></button></div>)}
    <button type="button" className="lexicon-link" onClick={() => patch({ related: [...m.related, { word:'', partOfSpeech:'', meaningZh:'' }] })}><Plus size={16}/>添加同根词</button>
    </details>
  </div>;
}
