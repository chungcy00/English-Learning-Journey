import { HandOutline } from './LearningArt';
import React from 'react';
import { Bookmark, Volume2 } from 'lucide-react';
import { USAGE_HEADINGS, type LearningEntry } from '../types';

export const usageLabels = { ...USAGE_HEADINGS, register:'语体差异（旧版）', natural:'自然表达（旧版）' };
function EntryExample({entry,pronounce}:{entry:LearningEntry;pronounce:(text:string)=>void}) {
  return entry.example ? <div className="lexicon-example"><button type="button" aria-label={`朗读例句：${entry.example}`} onClick={()=>pronounce(entry.example!)}><Volume2 size={16}/></button><div><p lang="en">{entry.example}</p>{entry.exampleTranslation&&<p className="lexicon-muted">{entry.exampleTranslation}</p>}</div></div> : null;
}
export function PhraseList({entries,isSaved,busy,pronounce,onToggle}:{entries:LearningEntry[];isSaved:(text:string)=>boolean;busy:boolean;pronounce:(text:string)=>void;onToggle:(entry:LearningEntry)=>void}) {
  return <ul className="lexicon-phrase-list">{entries.map(entry=><li key={entry.id} className="lexicon-phrase-card"><HandOutline/>
    <div className="lexicon-entry-heading">
      <div>
        <p className="lexicon-phrase-text" lang="en">{entry.text}</p>
        {entry.meaningZh && <p className="lexicon-phrase-meaning">{entry.meaningZh}</p>}
      </div>
      <div className="lexicon-entry-actions">
      <button type="button" aria-label={`朗读：${entry.text}`} onClick={()=>pronounce(entry.text)}><Volume2 size={18}/></button>
      <button type="button" disabled={busy} aria-label={`${isSaved(entry.text)?'取消':''}收藏：${entry.text}`} aria-pressed={isSaved(entry.text)} onClick={()=>onToggle(entry)}><Bookmark size={18} fill={isSaved(entry.text)?'currentColor':'none'}/></button>
    </div></div>
    <EntryExample entry={entry} pronounce={pronounce}/>{entry.note&&<p className="lexicon-note lexicon-muted">{entry.note}</p>}
  </li>)}</ul>;
}
export function UsageList({entries,pronounce,manual=false}:{entries:LearningEntry[];pronounce:(text:string)=>void;manual?:boolean}) {
  const hasExplanation = (entry: LearningEntry) => !!entry.meaningZh.trim()
    && (manual || !/^(用法辨析|用法解析|用法说明|补充说明)$/.test(entry.meaningZh.trim()));
  const hasContent = (entry: LearningEntry) => hasExplanation(entry)
    || !!(entry.example?.trim() || entry.note?.trim() || entry.contrast?.incorrect.trim() || entry.contrast?.correct.trim());
  const renderEntry = (entry: LearningEntry, legacy = false) => <div key={entry.id}>
    {legacy && entry.text.trim() && <p><strong>{entry.text}</strong></p>}
    {hasExplanation(entry) && <p>{entry.meaningZh}</p>}
    {entry.contrast && <dl className="lexicon-usage-contrast"><div><dt>误用</dt><dd lang="en">{entry.contrast.incorrect}</dd></div><div><dt>正确表达</dt><dd lang="en">{entry.contrast.correct}</dd></div></dl>}
    <EntryExample entry={entry} pronounce={pronounce}/>{entry.note?.trim() && <p className="lexicon-note lexicon-muted">{entry.note}</p>}
  </div>;
  const points = entries.filter(hasContent);
  const legacy = entries.filter(entry => (!entry.usageKind || !Object.hasOwn(USAGE_HEADINGS, entry.usageKind)) && (hasContent(entry) || entry.text.trim()));
  if (!points.length && !legacy.length) return <p className="lexicon-empty">暂无补充用法解析</p>;
  return <div className="lexicon-usage-list">
    {Object.entries(USAGE_HEADINGS).map(([kind, heading]) => {
      const group = points.filter(entry => entry.usageKind === kind);
      return group.length > 0 && <section key={kind} className="lexicon-usage-point">
        <h4>{heading}</h4>
        {group.map(entry => renderEntry(entry))}
      </section>;
    })}
    {legacy.map(entry => <div key={entry.id} className="lexicon-usage-point">{renderEntry(entry, true)}</div>)}
  </div>;
}
