import { HandOutline } from './LearningArt';
import React from 'react';
import { Bookmark, Volume2 } from 'lucide-react';
import { isLegacyEnglishExplanation } from '../utils/usageLanguage';
import type { LearningEntry } from '../types';

export const usageLabels = { scenario:'含义与场景', grammar:'语法与句型', comparison:'近义词辨析', error:'常见误用', register:'语体差异', natural:'自然表达' };
function EntryExample({entry,pronounce}:{entry:LearningEntry;pronounce:(text:string)=>void}) {
  return entry.example ? <div className="lexicon-example"><button type="button" aria-label={`朗读例句：${entry.example}`} onClick={()=>pronounce(entry.example!)}><Volume2 size={16}/></button><div><p lang="en">{entry.example}</p>{entry.exampleTranslation&&<p className="lexicon-muted">{entry.exampleTranslation}</p>}</div></div> : null;
}
export function PhraseList({entries,isSaved,busy,pronounce,onToggle}:{entries:LearningEntry[];isSaved:(text:string)=>boolean;busy:boolean;pronounce:(text:string)=>void;onToggle:(entry:LearningEntry)=>void}) {
  return <ul className="lexicon-phrase-list">{entries.map(entry=><li key={entry.id} className="lexicon-phrase-card"><HandOutline/>
    <div className="lexicon-entry-heading"><p className="lexicon-phrase-text" lang="en">{entry.text}</p><div className="lexicon-entry-actions">
      <button type="button" aria-label={`朗读：${entry.text}`} onClick={()=>pronounce(entry.text)}><Volume2 size={18}/></button>
      <button type="button" disabled={busy} aria-label={`${isSaved(entry.text)?'取消':''}收藏：${entry.text}`} aria-pressed={isSaved(entry.text)} onClick={()=>onToggle(entry)}><Bookmark size={18} fill={isSaved(entry.text)?'currentColor':'none'}/></button>
    </div></div>
    <p className="lexicon-phrase-meaning">{entry.meaningZh}</p>
    <EntryExample entry={entry} pronounce={pronounce}/>{entry.note&&<p className="lexicon-note lexicon-muted">{entry.note}</p>}
  </li>)}</ul>;
}
export function UsageList({entries,pronounce,manual=false}:{entries:LearningEntry[];pronounce:(text:string)=>void;manual?:boolean}) {
  return <div className="lexicon-usage-list">{entries.map(entry=>{
    const pendingTitle=!manual&&isLegacyEnglishExplanation(entry.text);
    const pendingMeaning=!manual&&isLegacyEnglishExplanation(entry.meaningZh);
    const pendingNote=!manual&&isLegacyEnglishExplanation(entry.note);
    const pendingTranslation=!manual&&isLegacyEnglishExplanation(entry.exampleTranslation);
    const placeholderMeaning=/^(用法辨析|用法说明|补充说明)$/.test(entry.meaningZh.trim());
    return <section key={entry.id} className="lexicon-usage-point">
      <h4>{pendingTitle ? '用法说明' : entry.text}</h4>{!pendingMeaning&&(!placeholderMeaning||manual)&&<p>{entry.meaningZh}</p>}
      {entry.contrast&&<dl className="lexicon-usage-contrast"><div><dt>误用</dt><dd lang="en">{entry.contrast.incorrect}</dd></div><div><dt>正确表达</dt><dd lang="en">{entry.contrast.correct}</dd></div></dl>}
      <EntryExample entry={pendingTranslation?{...entry,exampleTranslation:''}:entry} pronounce={pronounce}/>{entry.note&&!pendingNote&&<p className="lexicon-note lexicon-muted">{entry.note}</p>}
      {(pendingTitle||pendingMeaning||pendingNote||pendingTranslation)&&<p className="lexicon-muted" role="status">旧 AI 说明等待更新为中文，成功后会替换并删除旧说明。</p>}
    </section>;
  })}</div>;
}
