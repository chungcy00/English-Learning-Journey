import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { VocabularyItem } from '../types';
import { WordbookCustomAdd } from '../components/WordbookCustomAdd';
import { WordbookEntryDetails } from '../components/WordbookEntryDetails';
import { isCustomVocabulary } from '../utils/customVocabulary';
import { wordbookMeta, wordbookResults } from '../utils/wordbookManagement';

export function CustomWordsView({ vocabulary, onSave, onRequestRemove }: {
  vocabulary: VocabularyItem[];
  onSave: (word: VocabularyItem) => Promise<void>;
  onRequestRemove: (word: VocabularyItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const manual = useMemo(() => vocabulary.filter(isCustomVocabulary), [vocabulary]);
  const visible = useMemo(() => wordbookResults(manual, query, false).visible, [manual, query]);
  return <div className="page-shell page-stack custom-words-page">
    <header className="custom-words-heading"><h1 className="type-page font-editorial font-bold">自定义单词</h1></header>
    <WordbookCustomAdd reading={null} vocabulary={vocabulary} onSave={onSave} initiallyOpen/>
    <section className="custom-words-collection" aria-labelledby="custom-words-title">
      <div className="custom-words-list-heading"><h2 id="custom-words-title" className="type-section font-semibold">我添加的词条</h2><span className="lexicon-muted">{manual.length} 项</span></div>
      <label className="custom-words-search"><Search size={18} aria-hidden="true"/><span className="sr-only">搜索自定义词条</span><input type="search" placeholder="搜索自定义词条…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <ul className="custom-words-list">{visible.map(word=><li key={word.id}>
        <button type="button" className="custom-word-open" aria-expanded={expanded===word.id} aria-controls={`custom-word-${word.id}`} onClick={()=>setExpanded(expanded===word.id?null:word.id)}><span><strong>{word.term}</strong><small>{wordbookMeta(word)}</small></span><ChevronDown size={18} aria-hidden="true" className={expanded===word.id?'rotate-180':''}/></button>
        {expanded===word.id&&<div id={`custom-word-${word.id}`} role="region" aria-label={`${word.term} 的自定义学习资料`}><WordbookEntryDetails vocab={word} reading={null} onRemove={async item=>onRequestRemove(item)}/></div>}
      </li>)}</ul>
      {!visible.length&&<p className="lexicon-empty">{query.trim()?'没有匹配的自定义词条。':'还没有自定义词条，在上方添加第一个。'}</p>}
    </section>
  </div>;
}
