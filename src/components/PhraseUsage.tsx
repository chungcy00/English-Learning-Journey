import { HandOutline } from './LearningArt';
import React from 'react';
import { Bookmark, Volume2 } from 'lucide-react';
import { entryExamples } from '../utils/vocabularyEditor';
import type { LearningEntry } from '../types';

export function EntryExample({entry,pronounce}:{entry:LearningEntry;pronounce:(text:string)=>void}) {
  return <>{entryExamples(entry).map(example => <div className="lexicon-example" key={example.id}>
    {example.english && <button type="button" aria-label={`朗读例句：${example.english}`} onClick={()=>pronounce(example.english)}><Volume2 size={16}/></button>}
    <div>{example.english && <p lang="en">{example.english}</p>}{example.chinese&&<p className="lexicon-muted">{example.chinese}</p>}</div>
  </div>)}</>;
}
export function PhraseList({entries,isSaved,busy,pronounce,onToggle}:{entries:LearningEntry[];isSaved:(text:string)=>boolean;busy:boolean;pronounce:(text:string)=>void;onToggle:(entry:LearningEntry)=>void}) {
  return <ul className="lexicon-phrase-list">{entries.map(entry=><li key={entry.id} className="lexicon-phrase-card"><HandOutline/>
    <div className="lexicon-entry-heading">
      <p className="lexicon-phrase-text" lang="en">{entry.text}</p>
      <div className="lexicon-entry-actions">
      <button type="button" aria-label={`朗读：${entry.text}`} onClick={()=>pronounce(entry.text)}><Volume2 size={18}/></button>
      <button type="button" disabled={busy} aria-label={`${isSaved(entry.text)?'取消':''}收藏：${entry.text}`} aria-pressed={isSaved(entry.text)} onClick={()=>onToggle(entry)}><Bookmark size={18} fill={isSaved(entry.text)?'currentColor':'none'}/></button>
    </div></div>
    {entry.meaningZh && <p className="lexicon-phrase-meaning">{entry.meaningZh}</p>}
    <EntryExample entry={entry} pronounce={pronounce}/>{entry.note&&<p className="lexicon-note lexicon-muted">{entry.note}</p>}
  </li>)}</ul>;
}
export { UsageList } from './UsageAnalysis';
