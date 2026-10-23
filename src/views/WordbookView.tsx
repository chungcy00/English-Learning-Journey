import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Plus, BookOpenCheck, ArrowRight, ArrowDownAZ, ArrowUpZA, ListChecks, ChevronDown } from 'lucide-react';
import type { VocabularyItem, VocabStatus, CEFRLevel, ReadingType, ReadingLength, ReadingRecord } from '../types';
import { WordbookEntryDetails } from '../components/WordbookEntryDetails';
import { WordbookRemovalDialog } from '../components/WordbookRemovalDialog';
import { explainVocabularyTerm } from '../services/api';
import { normalizeEnglishTerm } from '../utils/englishSearch';
import { useReadingExpressions } from '../hooks/useReadingExpressions';
import { wordbookStatuses, wordbookMeta, wordbookResults, wordbookSuggestions, toggleVisibleSelection } from '../utils/wordbookManagement';

interface WordbookViewProps {
  vocabularyList: VocabularyItem[];
  scopeLabel?: string;
  readings?: ReadingRecord[];
  currentReading: ReadingRecord | null;
  onDeleteVocab: (id: string) => void;
  onRemoveVocab?: (vocab: VocabularyItem) => Promise<void>;
  onRestoreVocab?: (vocab: VocabularyItem) => Promise<void>;
  onDeleteVocabularies?: (ids: string[]) => Promise<void>;
  onUpdateStatus: (id: string, status: VocabStatus) => Promise<void>;
  onGenerateFromWordbook?: (params: {selectedTerms: string[]; cefrLevel: CEFRLevel; readingType: ReadingType; length: ReadingLength}) => void;
  isGenerating?: boolean;
  currentCefr: CEFRLevel;
  onSaveVocab: (vocab: VocabularyItem) => Promise<void>;
  onOpenReview: () => void;
}
export const WordbookView: React.FC<WordbookViewProps> = ({ vocabularyList, scopeLabel, currentReading, onDeleteVocab, onRemoveVocab, onRestoreVocab, onDeleteVocabularies, onUpdateStatus, currentCefr, onSaveVocab, onOpenReview, onGenerateFromWordbook, isGenerating }) => {
  const [search,setSearch]=useState('');
  const [readingType,setReadingType]=useState<ReadingType>('story');
  const [length,setLength]=useState<ReadingLength>('medium');
  const [statusFilter,setStatusFilter]=useState('All');
  const [descending,setDescending]=useState(false);
  const [batch,setBatch]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const [confirmIds,setConfirmIds]=useState<string[]|null>(null);
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
  const removeLock=useRef(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const readingId=useRef(currentReading?.id); readingId.current=currentReading?.id;
  const catalogue=useReadingExpressions(currentReading);
  const suggestions=useMemo(()=>wordbookSuggestions(currentReading,catalogue.expressions,vocabularyList,search),[currentReading,catalogue.expressions,vocabularyList,search]);
  const {visible:filtered,fallback}=useMemo(()=>wordbookResults(vocabularyList,search,statusFilter,descending),[vocabularyList,search,statusFilter,descending]);
  const [dismissed,setDismissed]=useState(false);
  const panelVisible=!!search.trim()&&!dismissed;
  useEffect(()=>{setSelected([]);},[search,statusFilter,currentReading?.id]);
  useEffect(()=>{setSearch('');setStatusFilter('All');setDetailId(null);setBatch(false);setError('');setSuccess('');},[currentReading?.id]);
  useEffect(()=>{const ids=new Set(vocabularyList.map(v=>v.id));setSelected(previous=>previous.filter(id=>ids.has(id)));},[vocabularyList]);
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
      const details=await explainVocabularyTerm(term,reading.content,true,{requireInReading:true});
      if(readingId.current!==reading.id)return;
      const now=Date.now();
      const item:VocabularyItem=existing?{...existing,...details}: {id:`vocab_custom_${crypto.randomUUID()}`,term:details.term||term,type:details.type||(term.includes(' ')?'phrase':'word'),phonetic:details.phonetic||'',partOfSpeech:details.partOfSpeech||'',meaningZh:details.meaningZh||'',definitionEn:details.definitionEn||'',example:details.example||'',collocations:details.collocations||[],status:'New',createdAt:now,updatedAt:now,nextReviewDate:now,reviewCount:0,currentInterval:0};
      await onSaveVocab({...item,savedManually:true,updatedAt:now,sourceReadingId:item.sourceReadingId||reading.id,sourceCefrLevel:item.sourceCefrLevel||reading.cefrLevel,addedFromReadingIds:[...new Set([...(item.addedFromReadingIds||[]),reading.id])],wordbookLevels:[...new Set([...(item.wordbookLevels||[]),reading.cefrLevel||currentCefr])]});
      if(readingId.current===reading.id)setSuccess(`已添加“${item.term}”`);
    }catch(e){if(readingId.current===reading.id)setError(e instanceof Error?e.message:'添加失败，请重试。');}
    finally{addLock.current=false;setAdding(null);}
  };
  const remove=async()=>{
    if(!confirmIds?.length||!onDeleteVocabularies||removeLock.current)return;
    removeLock.current=true;
    try{await onDeleteVocabularies(confirmIds);setConfirmIds(null);setSelected([]);setSuccess('已移出所选词条。');}
    finally{removeLock.current=false;}
  };
  return <div className="page-shell page-stack type-body wordbook-page wordbook-final">
    <header className="wordbook-final-heading"><h1 className="type-page font-ui font-semibold">个人生词本</h1><p className="wordbook-subtitle">My Wordbook</p><p className="wordbook-total">{scopeLabel || '当前短文已添加词条'}：{vocabularyList.length} 项</p></header>
    <button type="button" disabled={!vocabularyList.length} onClick={onOpenReview} className="wordbook-review"><BookOpenCheck aria-hidden="true" size={20}/>开始复习<ArrowRight aria-hidden="true" size={18}/></button>
    <section className="wordbook-unified-search" aria-label="搜索与添加表达">
      <div className="wordbook-search-capsule"><Search aria-hidden="true" size={20}/><input ref={input} type="search" value={search} maxLength={160} aria-label={scopeLabel ? '搜索已收录的词汇' : '搜索并添加当前短文的表达'} placeholder={scopeLabel ? '搜索已收录的词汇…' : '搜索并添加当前短文的表达…'}
        onChange={e=>{setSearch(e.target.value);setDismissed(false);setError('');setSuccess('');}} onFocus={()=>setDismissed(false)} onKeyDown={e=>{if(e.key==='Escape')setDismissed(true);}}/>
        {!!search&&<button type="button" aria-label="清除搜索" onClick={()=>{setSearch('');setError('');setSuccess('');input.current?.focus();}}><X aria-hidden="true" size={20}/></button>}
      </div>
      {panelVisible&&!!suggestions.length&&<div className="wordbook-suggestions" aria-label="当前短文可添加的表达"><h2>当前短文可添加的表达</h2><ul>{suggestions.map(({term,item,type})=><li key={term}><div><p className="wordbook-term">{item?.term||term}</p><p className="wordbook-meta">{wordbookMeta({partOfSpeech:item?.partOfSpeech||'',type})}</p></div><button type="button" aria-label={`添加 ${term}`} disabled={!!adding} onClick={()=>void add(term,item)} className="wordbook-add"><Plus aria-hidden="true" size={16}/>{adding===term?'添加中…':'添加'}</button></li>)}</ul></div>}
      {panelVisible&&catalogue.loading&&<p role="status" className="wordbook-message">正在加载短文表达…</p>}
      {panelVisible&&catalogue.error&&<p className="wordbook-message">{catalogue.error} <button type="button" onClick={catalogue.retry}>重试加载</button></p>}
      {error&&<p role="alert" className="wordbook-error">{error}</p>}{success&&<p role="status" className="wordbook-message">{success}</p>}
    </section>
    <section className="wordbook-management" aria-label="生词列表管理">
      <div className="wordbook-status-filters flex flex-wrap" role="group" aria-label="按学习状态筛选">{(['All','New','Learning','Difficult','Mastered'] as const).map(status=><button key={status} type="button" aria-pressed={statusFilter===status} onClick={()=>setStatusFilter(status)}>{status==='All'?'全部':wordbookStatuses[status]} <span className="wordbook-filter-count">{status==='All'?vocabularyList.length:vocabularyList.filter(v=>v.status===status).length}</span></button>)}</div>
      <div className="wordbook-action-bar"><button type="button" onClick={()=>setDescending(!descending)} aria-label={`字母排序：${descending?'Z 到 A，切换为 A 到 Z':'A 到 Z，切换为 Z 到 A'}`}>{descending?<ArrowUpZA aria-hidden="true" size={18}/>:<ArrowDownAZ aria-hidden="true" size={18}/>}字母排序 {descending?'Z–A':'A–Z'}</button><button type="button" aria-pressed={batch} onClick={()=>{setBatch(!batch);setSelected([]);setDetailId(null);}}><ListChecks aria-hidden="true" size={18}/>{batch?'完成管理':'批量管理'}</button></div>
      {batch&&<div className="wordbook-batch-bar"><button type="button" disabled={!filtered.length} onClick={()=>setSelected(previous=>toggleVisibleSelection(previous,filtered.map(v=>v.id)))}>{filtered.length>0&&filtered.every(v=>selected.includes(v.id))?'取消全选当前':'全选当前'}</button><span role="status">已选 {selected.length} 项</span><button type="button" disabled={!selected.length||!onDeleteVocabularies} onClick={()=>setConfirmIds([...selected])}>移出所选（{selected.length}）</button></div>}
      {batch&&selected.length>0&&onGenerateFromWordbook&&<details className="wordbook-regenerate"><summary>用所选词汇生成短文</summary><div>
        <label>文体<select aria-label="生成短文的类型" value={readingType} onChange={e=>setReadingType(e.target.value as ReadingType)}><option value="story">故事</option><option value="non-story">说明</option><option value="dialogue">对话</option></select></label>
        <label>篇幅<select aria-label="生成短文的篇幅" value={length} onChange={e=>setLength(e.target.value as ReadingLength)}><option value="short">短篇</option><option value="medium">中篇</option><option value="long">长篇</option></select></label>
        <button type="button" disabled={isGenerating} onClick={()=>onGenerateFromWordbook({selectedTerms:vocabularyList.filter(v=>selected.includes(v.id)).map(v=>v.term),cefrLevel:currentCefr,readingType,length})}>{isGenerating?'正在生成…':'生成短文'}</button>
      </div></details>}
      {fallback&&<p className="wordbook-message" role="status">部分匹配词条在其他学习状态中，已显示全部匹配结果。<button type="button" onClick={()=>setStatusFilter('All')}>查看全部状态</button></p>}
      <div className="wordbook-final-list" role="list" aria-label="已添加词条">{filtered.map(vocab=>{const expanded=detailId===vocab.id;const panelId=`wordbook-details-${vocab.id}`;return <div role="listitem" key={vocab.id} className={`wordbook-final-entry${expanded&&!batch?' is-expanded':''}`}><div className="wordbook-final-row">
        {batch&&<label className="wordbook-check"><input type="checkbox" aria-label={`选择 ${vocab.term}`} checked={selected.includes(vocab.id)} onChange={()=>setSelected(previous=>previous.includes(vocab.id)?previous.filter(id=>id!==vocab.id):[...previous,vocab.id])}/></label>}
        <button type="button" className="wordbook-entry-open" aria-label={`查看 ${vocab.term} 的词汇释义`} aria-expanded={expanded} aria-controls={panelId} onClick={()=>batch?setSelected(previous=>previous.includes(vocab.id)?previous.filter(id=>id!==vocab.id):[...previous,vocab.id]):setDetailId(expanded?null:vocab.id)}><span className="wordbook-entry-text"><span className="wordbook-term">{vocab.term}</span><span className="wordbook-meta">{wordbookMeta(vocab)}</span></span>{!batch&&<span className="wordbook-header-status"><span className="wordbook-state-badge" data-vocab-status={vocab.status}>{wordbookStatuses[vocab.status]}</span><ChevronDown aria-hidden="true" size={18} className={expanded?'rotate-180':''} /></span>}</button>
      </div>{expanded&&!batch&&<div id={panelId} role="region" aria-label={`${vocab.term} 的词条详情`}><WordbookEntryDetails vocab={vocab} reading={currentReading} onRemove={onRemoveVocab?removeEntry:undefined} onUpdateStatus={onUpdateStatus}/></div>}</div>;})}</div>
      {!filtered.length&&!(search.trim()&&suggestions.length)&&<p className="wordbook-empty" role="status">{search.trim()?'没有匹配的词条。':vocabularyList.length?'此状态暂无词条。':'暂无词条，可在上方搜索添加。'}</p>}
    </section>
    {removed&&<div className="wordbook-undo" role="status"><span>已移出生词本：{removed.term}</span><button type="button" disabled={undoBusy||!onRestoreVocab} onClick={()=>void undoRemoval()}>{undoBusy?'正在恢复…':'撤销'}</button>{undoError&&<p role="alert">{undoError}</p>}</div>}
    {confirmIds&&<WordbookRemovalDialog term={`${confirmIds.length} 个所选词条`} onCancel={()=>setConfirmIds(null)} onConfirm={remove}/>}
  </div>;
};
