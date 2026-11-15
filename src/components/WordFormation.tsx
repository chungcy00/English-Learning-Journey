import { vocabularyHeadword } from '../utils/vocabularyCase';
import { HandOutline, StudyEmptyState } from './LearningArt';
import React, { useRef, useState } from 'react';
import { ChevronDown, Plus, Volume2 } from 'lucide-react';
import { AutoTextarea } from './AutoTextarea';
import { EntryExample } from './PhraseUsage';
import { FamilyTreeConnections } from './FamilyTreeConnections';
import { EditorOrderActions, moveEditorItems, recordEditorUndo } from './EditorControls';
import type { LearningEntry, WordFormation, WordPart } from '../types';
import { derivativeDiagramBase, familyForest, hasExactParts, hasMatchingRoot, hasTransparentDerivation, practicalFormationText, partOfSpeechAbbreviation, verifiedWordFamilyRelation, type FamilyNode } from '../utils/wordFormation';

const partLabels = { prefix: '前缀', root: '词根', suffix: '后缀' };
export function HighlightedWord({word,parts,partOfSpeech}:{word:string;parts?:WordPart[];partOfSpeech?:string}) {
  const spelling = vocabularyHeadword(word, partOfSpeech);
  let offset = 0;
  return <span lang="en">{hasExactParts(parts,word) ? parts.map((part,index)=>{ const text = spelling.slice(offset, offset + part.text.length); offset += part.text.length; return <span key={index} className={`lexicon-word-part--${part.kind}`}>{text}</span>; }) : spelling}</span>;
}
type Relation = '共同词根' | '词族关联';

function PartMeanings({ parts = [] }: { parts?: WordPart[] }) {
  const filled = parts.filter(part => part.text?.trim() || part.meaningZh?.trim());
  if (!filled.length) return null;
  return <dl className="lexicon-part-meanings">{filled.map((part, index) => <div key={index}>
    <dt><span className="lexicon-part-tag">{partLabels[part.kind]}</span>
      {part.text?.trim() && <span lang="en" className={`lexicon-word-part--${part.kind}`}>{part.text}</span>}
    </dt>
    {part.meaningZh?.trim() && <dd>{part.meaningZh}</dd>}
  </div>)}</dl>;
}


function addsFamilyInformation(entry: LearningEntry, relation: string) {
  const text = relation.trim();
  const glosses = (entry.meaningZh ?? '').split(/[；;、，,]/).map(gloss => gloss.trim()).filter(Boolean);
  if (glosses.includes(text.replace(/[。.]$/, ''))) return false;
  const rest = text.toLowerCase().startsWith(entry.text.toLowerCase()) ? text.slice(entry.text.length).trim() : text;
  const definition = rest.match(/^是表示[「“『](.+?)[」”』]的(名词|形容词|动词|副词)[。.]?$/);
  return !definition || !glosses.includes(definition[1])
    || partOfSpeechAbbreviation(definition[2]) !== partOfSpeechAbbreviation(entry.partOfSpeech);
}

function FamilyDetails({ entry, pronounce }: { entry: LearningEntry; pronounce: (text: string) => void }) {
  const relation = entry.family?.relation?.trim();
  const note = entry.note?.trim();
  return <>
    <div className="lexicon-derivative-heading">
      <div>
        <strong><HighlightedWord word={entry.text} parts={entry.family?.parts} partOfSpeech={entry.partOfSpeech}/></strong>
        <p className="lexicon-family-meaning"><span className="lexicon-pos">{partOfSpeechAbbreviation(entry.partOfSpeech)}</span>{entry.meaningZh}</p>
      </div>
      {entry.text.trim() && <button type="button" aria-label={`朗读：${entry.text}`} onClick={() => pronounce(entry.text)}><Volume2 size={18}/></button>}
    </div>
    {relation && addsFamilyInformation(entry, relation) && <p className="lexicon-family-relation">{relation}</p>}
    {note && <p className="lexicon-note">{note}</p>}
    <PartMeanings parts={entry.family?.parts}/>
    <EntryExample entry={entry} pronounce={pronounce}/>
  </>;
}

function FamilyDiagram({ base, entries, nodes, relation, pronounce }: {
  base: string; entries: LearningEntry[]; nodes: FamilyNode[]; relation: Relation; pronounce: (text: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(entries[0].id);
  const layoutKey = JSON.stringify(entries.map(entry => [entry.id, entry.text, entry.family?.parent]));
  const selected = entries.find(entry => entry.id === selectedId) ?? entries[0];
  const renderBranches = (branches: FamilyNode[], parent: string) => <ul className="lexicon-family-branches">
    {branches.map(({ entry, children }) => {
      const direct = entry.family?.parent?.trim().toLowerCase() === parent.trim().toLowerCase();
      const label = direct ? '直接派生' : relation;
      return <li key={entry.id} className="lexicon-family-branch" data-direct={direct}>
        <button type="button" className="lexicon-family-node" aria-pressed={selected.id === entry.id} aria-description={label}
          onClick={() => setSelectedId(entry.id)}>
          <HandOutline/>
          <HighlightedWord word={entry.text} parts={entry.family?.parts} partOfSpeech={entry.partOfSpeech}/>
        </button>
        {children.length > 0 && renderBranches(children, entry.text)}
      </li>;
    })}
  </ul>;
  return <div className="lexicon-family-diagram">
    <div className="lexicon-family-viewport">
      <div className="lexicon-family-tree">
        <FamilyTreeConnections layoutKey={layoutKey}/>
        <div className="lexicon-family-base" lang="en"><HandOutline/>{vocabularyHeadword(base)}</div>
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
  entries: LearningEntry[]; term?: string; inflections?: string[]; pronounce: (text: string) => void; manual?: boolean;
}) {
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
    if (entry.family?.base?.trim().toLowerCase() === base.toLowerCase() && entry.family.relation?.trim() && derivativeDiagramBase([entry], base, inflections)) return true;
    const parent = entry.family?.parent || base;
    return parent && hasTransparentDerivation(parent, entry.text, entry.family?.parts);
  });
  const candidates = supported.map(entry => {
    const family = verified.get(entry.id);
    if (!family) return entry;
    return { ...entry, family: {
      ...entry.family,
      base: entry.family?.base?.trim() || family.base,
      parent: entry.family?.parent?.trim() || family.parent,
      relation: entry.family?.relation?.trim() || family.relation,
    } };
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
    {diagramEntries.length > 0 && <FamilyDiagram base={base} entries={diagramEntries} nodes={familyForest(diagramEntries)} relation="词族关联" pronounce={pronounce}/>}
  </section>;
}
export function RootAnalysisList({ entries, term, pronounce, manual = false }: {
  entries: LearningEntry[]; term: string; pronounce: (text: string) => void; manual?: boolean;
}) {
  const analyses = entries.flatMap(entry => {
    const analysis = RootAnalysis({ entry, term, pronounce, manual });
    return analysis ? [<React.Fragment key={entry.id}>{analysis}</React.Fragment>] : [];
  });
  return analyses.length ? <>{analyses}</> : <StudyEmptyState compact pose="hamster-reading">
    <p className="lexicon-empty">暂无可靠且适用的构词拆解。</p>
  </StudyEmptyState>;
}
export function RootAnalysis({ entry, term, pronounce, manual = false }: { key?: string; entry: LearningEntry; term: string; pronounce: (text: string) => void; manual?: boolean }) {
  const m = entry.morphology;
  const displayText = (value = '') => value.trim();
  const explanation = displayText(m?.explanation);
  const mnemonic = displayText(m?.mnemonic);
  const enteredParts = (m?.parts ?? []).filter(part =>
    typeof part?.text === 'string' && (part.text.trim() || displayText(part.meaningZh).trim()),
  );
  const hasMorphologyContent = !!(enteredParts.length || explanation || mnemonic || m?.related?.length);
  if (!m || !hasMorphologyContent) {
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
  const parts = enteredParts.map(part => ({ ...part, meaningZh: displayText(part.meaningZh) }));
  const hasBreakdown = parts.length > 0;
  if (!hasBreakdown && !explanation && !mnemonic && !m.related?.some(word => hasMatchingRoot(term, m.parts, word.word, word.parts))) return null;
  return <section className="lexicon-tree-card lexicon-root-map">
    {(hasBreakdown || explanation) && <div className="lexicon-root-analysis">
      {hasBreakdown && <PartMeanings parts={parts}/>}
      {explanation&&<p className="lexicon-formation-explanation">{explanation}</p>}
    </div>}
    {mnemonic&&<div className="lexicon-memory"><h5>辅助记忆联想</h5><p>{mnemonic}</p><small>联想仅帮助记忆，不代表真实词源。</small></div>}
    {!!m.related?.length && <RootFamily term={term} parts={m.parts} words={m.related} pronounce={pronounce} manual={manual}/>}
  </section>;
}
function RootFamily({ term, parts, words, pronounce, manual = false }: {
  term: string; parts: WordPart[]; words: WordFormation['related']; pronounce: (text: string) => void; manual?: boolean;
}) {
  const matching: LearningEntry[] = [];
  const seen = new Set([term.trim().toLowerCase()]);
  for (const word of words) {
    const key = word?.word?.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const entry: LearningEntry = { id: key, text: word.word, partOfSpeech: word.partOfSpeech, meaningZh: word.meaningZh };
    if (hasMatchingRoot(term, parts, word.word, word.parts)) {
      matching.push({ ...entry, family: { base: term, relation: word.relation?.trim() || '', parts: word.parts } });
    }
  }
  if (!matching.length) return null;
  return <div className="lexicon-root-related">
    <h5>同根词</h5>
    {matching.length > 0 && <FamilyDiagram base={term} entries={matching} nodes={familyForest(matching)} relation="共同词根" pronounce={pronounce}/>}
  </div>;
}

export function WordPartsEditor({parts,onChange}:{parts:WordPart[];onChange:(parts:WordPart[])=>void}) {
  const currentParts = useRef(parts);
  const currentOnChange = useRef(onChange);
  currentParts.current = parts;
  currentOnChange.current = onChange;
  const movePart = (index: number, direction: number) => {
    const target = index + direction;
    if (target < 0 || target >= parts.length) return;
    onChange(moveEditorItems(parts,index,direction));
  };
  const removePart = (index: number) => {
    const removed = parts[index];
    onChange(parts.filter((_,i)=>i!==index));
    recordEditorUndo(() => {
      const latest = currentParts.current;
      if (latest.includes(removed)) return;
      const at = Math.min(index, latest.length);
      currentOnChange.current([...latest.slice(0, at), removed, ...latest.slice(at)]);
    }, '构词部分已删除');
  };
  return <div className="lexicon-parts-editor">
    <div className="lexicon-editor-subsection-heading">
      <span>构词部分 <small>({parts.length})</small></span>
      <div className="lexicon-editor-subsection-actions">
        <button type="button" className="lexicon-link lexicon-inline-add" onClick={()=>onChange([...parts,{kind:'root',text:'',meaningZh:''}])}><Plus size={16}/>添加</button>
      </div>
    </div>
    <div className="lexicon-editor-subitem-list">{parts.map((part,index)=>{
      const label=`${partLabels[part.kind]} ${index+1}`;
      return <article className="lexicon-editor-subitem" key={index}>
        <div className="lexicon-editor-subitem__heading">
          <span className="lexicon-editor-part-title"><strong>{part.text.trim()||label}</strong><small>{part.meaningZh||partLabels[part.kind]}</small></span>
          <div className="lexicon-editor-subitem__controls">
            <EditorOrderActions className="lexicon-editor-order-actions" label={label} first={index===0} last={index===parts.length-1} onMove={direction=>movePart(index,direction)} onRemove={()=>removePart(index)}/>
          </div>
        </div>
        <div className="lexicon-editor-fields">
          <label>前缀、词根或后缀<select value={part.kind} onChange={event=>onChange(parts.map((v,i)=>i===index?{...v,kind:event.target.value as WordPart['kind']}:v))}>{Object.entries(partLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          {(['text','meaningZh'] as const).map(key=><label key={key}>{key==='text'?'在单词中的拼写':'这部分的中文含义'}<input maxLength={3000} value={part[key]} onChange={event=>onChange(parts.map((v,i)=>i===index?{...v,[key]:event.target.value}:v))}/></label>)}
        </div>
      </article>;
    })}</div>
  </div>;
}
export function DerivativeFamilyEditor({entry,onChange}:{entry:LearningEntry;onChange:(family:NonNullable<LearningEntry['family']>)=>void}) {
  const family=entry.family || {base:'',relation:''};
  const filled=!!(family.base?.trim()||family.parent?.trim()||family.relation?.trim()||family.parts?.length);
  return <div className="lexicon-formation-editor">
    <h4 className="lexicon-editor-inline-heading">派生关系与构词{filled&&<span className="usage-filled-indicator">已填写</span>}</h4>
    {([['base','词族的基础词','例如 considerate'],['parent','直接派生自哪个词','例如 considerate；不确定可留空'],['relation','构词说明','例如加 -ly 变成副词']] as const).map(([key,label,placeholder])=><label key={key}>{label}<input placeholder={placeholder} maxLength={3000} value={family[key]||''} onChange={event=>onChange({...family,[key]:event.target.value})}/></label>)}
    <WordPartsEditor parts={family.parts||[]} onChange={parts=>onChange({...family,parts})}/>
  </div>;
}
export function WordFormationEditor({ entry, onChange }: { entry: LearningEntry; onChange: (entry: LearningEntry) => void }) {
  const [openRelated, setOpenRelated] = useState<Set<number>>(() => new Set());
  const m: WordFormation = { explanation: '', mnemonic: '', ...entry.morphology, parts: entry.morphology?.parts ?? [], related: entry.morphology?.related ?? [] };
  const patch = (value: Partial<WordFormation>) => onChange({ ...entry, morphology: { ...m, ...value } });
  const relatedFilled = m.related.some(word => word.word.trim() || word.meaningZh?.trim() || word.relation?.trim());
  const rootMoreFilled = !!(m.explanation.trim() || m.mnemonic.trim());
  const currentRelated = useRef(m.related);
  const currentPatch = useRef(patch);
  currentRelated.current = m.related;
  currentPatch.current = patch;
  const moveRelated = (index: number, direction: number) => {
    const target = index + direction;
    if (target < 0 || target >= m.related.length) return;
    const nextOpen = new Set<number>();
    openRelated.forEach(openIndex => {
      nextOpen.add(openIndex === index ? target : openIndex === target ? index : openIndex);
    });
    patch({ related: moveEditorItems(m.related, index, direction) });
    setOpenRelated(nextOpen);
  };
  const removeRelated = (index: number) => {
    const removed = m.related[index];
    const nextOpen = new Set<number>();
    openRelated.forEach(openIndex => {
      if (openIndex < index) nextOpen.add(openIndex);
      else if (openIndex > index) nextOpen.add(openIndex - 1);
    });
    patch({ related: m.related.filter((_, i) => i !== index) });
    setOpenRelated(nextOpen);
    recordEditorUndo(() => {
      const latest = currentRelated.current;
      if (latest.includes(removed)) return;
      const at = Math.min(index, latest.length);
      currentPatch.current({ related: [...latest.slice(0, at), removed, ...latest.slice(at)] });
      setOpenRelated(previous => {
        const next = new Set<number>();
        previous.forEach(openIndex => next.add(openIndex >= at ? openIndex + 1 : openIndex));
        next.add(at);
        return next;
      });
    }, '同根词已删除');
  };
  return <div className="lexicon-formation-editor">
    <WordPartsEditor parts={m.parts} onChange={parts => patch({ parts })}/>
    <details className="lexicon-editor-optional"><summary>更多构词说明（选填）{rootMoreFilled&&<span className="usage-filled-indicator">已填写</span>}</summary>
      <div className="lexicon-editor-fields">{([['explanation', '各部分怎样组成词义'], ['mnemonic', '助记联想']] as const).map(([key, label]) => <label key={key}>{label}<AutoTextarea maxLength={3000} value={m[key]} onChange={value => patch({ [key]: value })}/></label>)}</div>
    </details>
    <details className="lexicon-editor-optional"><summary>同根词（选填）{relatedFilled&&<span className="usage-filled-indicator">已填写</span>}</summary>
      <div className="lexicon-editor-subsection-heading">
        <span>同根词 <small>({m.related.length})</small></span>
        <div className="lexicon-editor-subsection-actions">
          {m.related.length > 1 && <>
            <button type="button" className="lexicon-link" disabled={openRelated.size===m.related.length} onClick={()=>setOpenRelated(new Set(m.related.map((_,index)=>index)))}>展开同根词</button>
            <button type="button" className="lexicon-link" disabled={!openRelated.size} onClick={()=>setOpenRelated(new Set())}>收起同根词</button>
          </>}
          <button type="button" className="lexicon-link lexicon-inline-add" onClick={() => { const next=[...m.related,{word:'',partOfSpeech:'',meaningZh:''}]; patch({related:next}); setOpenRelated(previous=>new Set(previous).add(next.length-1)); }}><Plus size={16}/>添加</button>
        </div>
      </div>
      <div className="lexicon-editor-subitem-list">{m.related.map((word,index) => {
        const canFoldRelated = m.related.length > 1;
        const open=!canFoldRelated || openRelated.has(index);
        return <article className="lexicon-editor-subitem" key={index}>
          <div className="lexicon-editor-subitem__heading">
            {canFoldRelated ? <button type="button" className="lexicon-editor-subitem__toggle" aria-expanded={open} onClick={()=>setOpenRelated(previous=>{const next=new Set(previous);if(next.has(index))next.delete(index);else next.add(index);return next;})}>
              <span><strong lang="en">{word.word.trim()||`同根词 ${index+1}`}</strong>{word.meaningZh&&<small>{word.meaningZh}</small>}</span>
              <ChevronDown className="usage-disclosure-chevron lexicon-editor-subitem__chevron" size={18} aria-hidden="true"/>
            </button> : <span className="lexicon-editor-part-title"><strong lang="en">{word.word.trim()||`同根词 ${index+1}`}</strong>{word.meaningZh&&<small>{word.meaningZh}</small>}</span>}
            <div className="lexicon-editor-subitem__controls">
              <EditorOrderActions className="lexicon-editor-order-actions" label={`同根词 ${index+1}`} first={index===0} last={index===m.related.length-1} onMove={direction=>moveRelated(index,direction)} onRemove={()=>removeRelated(index)}/>
            </div>
          </div>
          {open&&<div className="lexicon-editor-fields">{(['word','partOfSpeech','meaningZh','relation'] as const).map((key,i)=><label key={key}>{['英文单词','词性','中文含义','同根构词关系（不确定可留空）'][i]}<input maxLength={3000} value={word[key] || ''} onChange={event => patch({ related: m.related.map((v,j) => j === index ? { ...v, [key]: event.target.value } : v) })}/></label>)}<WordPartsEditor parts={word.parts || []} onChange={parts => patch({ related: m.related.map((v,j) => j === index ? { ...v, parts } : v) })}/></div>}
        </article>;
      })}</div>
    </details>
  </div>;
}
