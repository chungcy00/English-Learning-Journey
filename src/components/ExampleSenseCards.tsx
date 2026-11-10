import { HandOutline } from './LearningArt';
import React from 'react';
import { Bookmark, Volume2 } from 'lucide-react';
import type { LearningEntry } from '../types';
import { partOfSpeechAbbreviation } from '../utils/wordFormation';

export interface SenseExample { source: LearningEntry; sentence: string; translation: string; legacyKey?: string }
export interface SenseExampleGroup { key: string; meaning: string; pos: string; examples: SenseExample[] }
export function groupSenseExamples(entries: LearningEntry[], senses: LearningEntry[], defaultPos = '') {
  const groups = new Map<string,SenseExampleGroup>();
  for (const source of entries) {
    const linked = senses.find(sense=>sense.id===source.senseId);
    const legacy = !!source.example && source.example!==source.text && !/[.!?]\s*$/.test(source.text) && source.text.trim().split(/\s+/).length<=4;
    const fallback = senses.length===1 ? senses[0] : undefined;
    const meaning = source.senseMeaningZh || (legacy ? source.meaningZh : '') || linked?.meaningZh || fallback?.meaningZh || '';
    const pos = source.partOfSpeech || linked?.partOfSpeech || fallback?.partOfSpeech || defaultPos;
    const key = `${linked?.id || ''}:${pos}:${meaning}`;
    if (!groups.has(key)) groups.set(key,{key,meaning,pos,examples:[]});
    const list=groups.get(key)!.examples;
    list.push({source,sentence:legacy?source.example!:source.text,translation:legacy?(source.exampleTranslation||''):source.meaningZh,legacyKey:legacy?source.text:undefined});
    if (!legacy && source.example && source.example!==source.text) list.push({source,sentence:source.example,translation:source.exampleTranslation||''});
  }
  return [...groups.values()];
}
export function ExampleSenseCards({entries,senses,defaultPos,isSaved,busy,pronounce,onToggle}:{entries:LearningEntry[];senses:LearningEntry[];defaultPos?:string;isSaved:(text:string)=>boolean;busy:boolean;pronounce:(text:string)=>void;onToggle:(entry:LearningEntry)=>void}) {
  return <div className="lexicon-sense-cards">{groupSenseExamples(entries,senses,defaultPos).map(group=><section className="lexicon-sense-card" key={group.key}><HandOutline/>
    {group.meaning&&<h4><span className="lexicon-pos">{partOfSpeechAbbreviation(group.pos)}</span>{group.meaning}</h4>}
    {group.examples.map(({source,sentence,translation,legacyKey},index)=>{
      const legacySaved=!!legacyKey&&isSaved(legacyKey);const saved=isSaved(sentence)||legacySaved;
      return <div className="lexicon-sense-example" key={`${source.id}:${index}`}>
        <button type="button" aria-label={`朗读：${sentence}`} onClick={()=>pronounce(sentence)}><Volume2 size={18}/></button>
        <div><p lang="en">{sentence}</p>{translation&&<p className="lexicon-muted">{translation}</p>}{source.note&&<p className="lexicon-note lexicon-muted">{source.note}</p>}</div>
        <button type="button" disabled={busy} aria-label={`${saved?'取消':''}收藏：${sentence}`} aria-pressed={saved} onClick={()=>onToggle(legacySaved?source:{...source,text:sentence,meaningZh:translation})}><Bookmark size={18} fill={saved?'currentColor':'none'}/></button>
      </div>;
    })}
  </section>)}</div>;
}
