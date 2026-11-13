import { HandOutline } from './LearningArt';
import React from 'react';
import { Bookmark, Volume2 } from 'lucide-react';
import type { LearningEntry } from '../types';

function EntryExample({entry,pronounce}:{entry:LearningEntry;pronounce:(text:string)=>void}) {
  return entry.example ? <div className="lexicon-example"><button type="button" aria-label={`朗读例句：${entry.example}`} onClick={()=>pronounce(entry.example!)}><Volume2 size={16}/></button><div><p lang="en">{entry.example}</p>{entry.exampleTranslation&&<p className="lexicon-muted">{entry.exampleTranslation}</p>}</div></div> : null;
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
