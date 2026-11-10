import { HandOutline } from './LearningArt';
import React from 'react';
import { Volume2 } from 'lucide-react';
import type { LearningEntry } from '../types';
export function DefinitionCards({entries,pronounce}:{entries:LearningEntry[];pronounce:(text:string)=>void}) {
  // Keep legacy translations in storage/editor; only the English definition is displayed.
  const definitions = entries.filter(entry=>/[a-z]/i.test(entry.text) && !/[\u3400-\u9fff]/.test(entry.text));
  if (!definitions.length) return <p className="lexicon-empty" lang="en">No English definition available.</p>;
  return <div className="lexicon-definition-list">{definitions.map(entry=><section className="lexicon-definition-card" key={entry.id}><HandOutline/>
    <button type="button" aria-label={`Read definition: ${entry.text}`} onClick={()=>pronounce(entry.text)}><Volume2 size={18} aria-hidden="true"/></button>
    <p lang="en">{entry.text}</p>
  </section>)}</div>;
}
