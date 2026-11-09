import { SavedMaterialsView } from '../components/SavedMaterialsView';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Plus, BookOpenCheck, ArrowRight, ArrowDownAZ, ArrowUpZA, ChevronDown } from 'lucide-react';
import type { VocabularyItem, CEFRLevel, ReadingType, ReadingLength, ReadingRecord } from '../types';
import { WordbookCustomAdd } from '../components/WordbookCustomAdd';
import { WordbookEntryDetails } from '../components/WordbookEntryDetails';
import {AnchoredSelect} from '../components/ReviewCategorySelect';
import {SwipeToRemove} from '../components/SwipeToRemove';
import { normalizeEnglishTerm } from '../utils/englishSearch';
import { useReadingExpressions } from '../hooks/useReadingExpressions';
import { wordbookMeta, wordbookResults, wordbookSuggestions } from '../utils/wordbookManagement';

interface WordbookViewProps {
  vocabularyList: VocabularyItem[];
  scopeLabel?: string;
  readings?: ReadingRecord[];
  currentReading: ReadingRecord | null;
  onDeleteVocab: (id: string) => void;
  onRemoveVocab?: (vocab: VocabularyItem) => Promise<void>;
  onRestoreVocab?: (vocab: VocabularyItem) => Promise<void>;
  onDeleteVocabularies?: (ids: string[]) => Promise<void>;
  onGenerateFromWordbook?: (params: {selectedTerms: string[]; cefrLevel: CEFRLevel; readingType: ReadingType; length: ReadingLength}) => void;
  isGenerating?: boolean;
  currentCefr: CEFRLevel;
  onSaveVocab: (vocab: VocabularyItem) => Promise<void>;
  onOpenReview: () => void;
}
export const WordbookView: React.FC<WordbookViewProps> = ({ vocabularyList, scopeLabel, currentReading, onDeleteVocab, onRemoveVocab, onRestoreVocab, currentCefr, onSaveVocab, onOpenReview }) => {
  const [search,setSearch]=useState('');
  const [contentView, setContentView] = useState<'words' | 'example'>('words');
  const [descending,setDescending]=useState(false);
  const [removingId,setRemovingId]=useState<string|null>(null);
  const [detailId,setDetailId]=useState<string|null>(null);
  const [removed,setRemoved]=useState<VocabularyItem|null>(null);
  const [undoBusy,setUndoBusy]=useState(false);
  const [undoError,setUndoError]=useState('');
  const undoLock=useRef(false);
  useEffect(()=>{
    if(!removed || undoBusy || undoError)return;
    const timer=window.setTimeout(()=>setRemoved(null),6000);
    return()=>window.clearTimeout(timer);
  },[removed,undoBusy,undoError]);
  useEffect(()=>{
    setRemoved(null);setUndoError('');
  },[currentReading?.id]);
  useEffect(()=>{
    if(removed && vocabularyList.some(v=>normalizeEnglishTerm(v.term)===normalizeEnglishTerm(removed.term)))setRemoved(null);
  },[vocabularyList,removed]);
  const removeEntry=async(vocab:VocabularyItem)=>{
    if(!onRemoveVocab)return;
    const id=readingId.current;
    await onRemoveVocab(vocab);
    if(readingId.current===id){setDetailId(null);setRemoved(vocab);setUndoError('');}
  };
  const undoRemoval=async()=>{
    if(!removed||!onRestoreVocab||undoLock.current)return;
    const vocab=removed;
    const id=readingId.current;
    undoLock.current=true;setUndoBusy(true);setUndoError('');
    try{await onRestoreVocab(vocab);if(readingId.current===id)setRemoved(null);}
    catch{if(readingId.current===id)setUndoError('撤销未完成，请重试。');}
    finally{undoLock.current=false;setUndoBusy(false);}
  };
  const [adding,setAdding]=useState<string|null>(null);
  const addLock=useRef(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const readingId=useRef(currentReading?.id); readingId.current=currentReading?.id;
  const catalogue=useReadingExpressions(currentReading);
  const suggestions=useMemo(()=>wordbookSuggestions(currentReading,catalogue.expressions,vocabularyList,search),[currentReading,catalogue.expressions,vocabularyList,search]);
  const {visible:filtered}=useMemo(()=>wordbookResults(vocabularyList,search,descending),[vocabularyList,search,descending]);
  const [dismissed,setDismissed]=useState(false);
  const panelVisible=!!search.trim()&&!dismissed;
  useEffect(()=>{setSearch('');setDetailId(null);setError('');setSuccess('');},[currentReading?.id]);
  useEffect(()=>{
    const viewport=window.visualViewport; if(!viewport)return;
    const ensureVisible=()=>{if(document.activeElement===input.current && viewport.scale===1){const r=input.current!.getBoundingClientRect();if(r.bottom>viewport.height+viewport.offsetTop)input.current!.scrollIntoView({block:'nearest'});}};
    viewport.addEventListener('resize',ensureVisible);return()=>viewport.removeEventListener('resize',ensureVisible);
  },[]);
  const add=async(term:string, existing?:VocabularyItem)=>{
    if(addLock.current||!currentReading)return;
    addLock.current=true;setAdding(term);setError('');setSuccess('');
    const reading=currentReading;
    try{
      const details = existing || reading.selectedVocabulary.find(item => item.term === term);
      if (!details) throw new Error('请使用添加单词／词组入口，按需补充资料。');
      if(readingId.current!==reading.id)return;
      const now=Date.now();
      const item:VocabularyItem=existing?{...existing,...details}: {id:`vocab_custom_${crypto.randomUUID()}`,term:details.term||term,type:details.type||(term.includes(' ')?'phrase':'word'),phonetic:details.phonetic||'',partOfSpeech:details.partOfSpeech||'',meaningZh:details.meaningZh||'',definitionEn:details.definitionEn||'',example:details.example||'',collocations:details.collocations||[],status:'New',createdAt:now,updatedAt:now,nextReviewDate:now,reviewCount:0,currentInterval:0};
      await onSaveVocab({...item,savedManually:true,updatedAt:now,sourceReadingId:item.sourceReadingId||reading.id,sourceCefrLevel:item.sourceCefrLevel||reading.cefrLevel,addedFromReadingIds:[...new Set([...(item.addedFromReadingIds||[]),reading.id])],wordbookLevels:[...new Set([...(item.wordbookLevels||[]),reading.cefrLevel||currentCefr])]});
      if(readingId.current===reading.id)setSuccess(`已添加“${item.term}”`);
    }catch(e){if(readingId.current===reading.id)setError(e instanceof Error?e.message:'添加失败，请重试。');}
    finally{addLock.current=false;setAdding(null);}
  };
  return <div className="page-shell page-stack type-body wordbook-page wordbook-final">
    <header className="wordbook-final-heading"><h1 className="type-page font-ui font-semibold">个人生词本</h1><p className="wordbook-total">{scopeLabel || '全部词条'}：{vocabularyList.length} 项</p></header>
    <div className="wordbook-collection-bar"><BookOpenCheck aria-hidden="true" size={20}/><div className="wordbook-view-control"><AnchoredSelect ariaLabel="单词本内容视图" className="wordbook-view-select" value={contentView} disabled={false} options={[{value:'words',label:'词汇'},{value:'example',label:'例句'}]} onChange={value=>{setContentView(value as 'words'|'example');setSearch('');setDetailId(null);}}/></div><button type="button" disabled={!vocabularyList.length} onClick={onOpenReview} className="wordbook-review">开始复习<ArrowRight aria-hidden="true" size={16}/></button></div>
    <section className="wordbook-unified-search" aria-label="搜索与添加表达">
      <div className="wordbook-search-capsule"><Search aria-hidden="true" size={20}/><input ref={input} type="search" value={search} maxLength={160} aria-label={scopeLabel ? '搜索已收录的词汇' : '搜索并添加当前短文的表达'} placeholder="搜索词条或收藏内容…"
        onChange={e=>{setSearch(e.target.value);setDismissed(false);setError('');setSuccess('');}} onFocus={()=>setDismissed(false)} onKeyDown={e=>{if(e.key==='Escape')setDismissed(true);}}/>
        {!!search&&<button type="button" aria-label="清除搜索" onClick={()=>{setSearch('');setError('');setSuccess('');input.current?.focus();}}><X aria-hidden="true" size={20}/></button>}
      </div>
      {contentView === 'words' && panelVisible&&!!suggestions.length&&<div className="wordbook-suggestions" aria-label="当前短文可添加的表达"><h2>当前短文可添加的表达</h2><ul>{suggestions.map(({term,item,type})=><li key={term}><div><p className="wordbook-term">{item?.term||term}</p><p className="wordbook-meta">{wordbookMeta({partOfSpeech:item?.partOfSpeech||'',type})}</p></div><button type="button" aria-label={`添加 ${term}`} disabled={!!adding} onClick={()=>void add(term,item)} className="wordbook-add"><Plus aria-hidden="true" size={16}/>{adding===term?'添加中…':'添加'}</button></li>)}</ul></div>}
      {contentView === 'words' && panelVisible&&catalogue.loading&&<p role="status" className="wordbook-message">正在加载短文表达…</p>}
      {contentView === 'words' && panelVisible&&catalogue.error&&<p className="wordbook-message">{catalogue.error} <button type="button" onClick={catalogue.retry}>重试加载</button></p>}
      {error&&<p role="alert" className="wordbook-error">{error}</p>}{success&&<p role="status" className="wordbook-message">{success}</p>}
    </section>
    {contentView === 'words' && <div className="wordbook-add-tools"><WordbookCustomAdd reading={currentReading} vocabulary={vocabularyList} onSave={onSaveVocab}/>      <button type="button" className="wordbook-sort" onClick={()=>setDescending(!descending)} aria-label={`字母排序：${descending?'Z 到 A，切换为 A 到 Z':'A 到 Z，切换为 Z 到 A'}`}>{descending?<ArrowUpZA aria-hidden="true" size={18}/>:<ArrowDownAZ aria-hidden="true" size={18}/>}字母排序 {descending?'Z–A':'A–Z'}</button></div>}
    {contentView !== 'words' ? <SavedMaterialsView type="example" search={search}/> : <section className="wordbook-management" aria-label="生词列表管理">
      <div className="wordbook-final-list" role="list" aria-label="已添加词条">{filtered.map(vocab=>{const expanded=detailId===vocab.id;const panelId=`wordbook-details-${vocab.id}`;return <SwipeToRemove key={vocab.id} label={vocab.term} disabled={!!removingId||undoBusy||expanded} onRemove={async()=>{if(removingId)return;if(!onRemoveVocab){onDeleteVocab(vocab.id);return;}setRemovingId(vocab.id);setError('');try{await removeEntry(vocab);}catch{setError('移除失败，已有资料已保留，请重试。');}finally{setRemovingId(null);}}}><div className={`wordbook-final-entry${expanded?' is-expanded':''}`}><div className="wordbook-final-row">
        <button type="button" className="wordbook-entry-open" aria-label={`查看 ${vocab.term} 的词汇释义`} aria-expanded={expanded} aria-controls={panelId} onClick={()=>setDetailId(expanded?null:vocab.id)}><span className="wordbook-entry-text"><span className="wordbook-term">{vocab.term}</span><span className="wordbook-meta">{wordbookMeta(vocab)}</span></span>{<ChevronDown aria-hidden="true" size={18} className={expanded?'rotate-180':''} />}</button>
      </div>{expanded&&<div id={panelId} role="region" aria-label={`${vocab.term} 的词条详情`}><WordbookEntryDetails vocab={vocab} reading={currentReading} onRemove={onRemoveVocab?removeEntry:undefined}/></div>}</div></SwipeToRemove>;})}</div>
      {!filtered.length&&!(search.trim()&&suggestions.length)&&<p className="wordbook-empty" role="status">{search.trim()?'没有匹配的词条。':vocabularyList.length?'暂无匹配词条。':'暂无词条，可在上方搜索添加。'}</p>}
    </section>
    }
    {contentView==='words'&&<SavedMaterialsView type="phrase" search={search} hideWhenEmpty/>}
    {removed&&<div className="wordbook-undo" role="status"><span>已移出生词本：{removed.term}</span><button type="button" disabled={undoBusy||!onRestoreVocab} onClick={()=>void undoRemoval()}>{undoBusy?'正在恢复…':'撤销'}</button>{undoError&&<p role="alert">{undoError}</p>}</div>}
  </div>;
};
