import { LoadingAnimation } from './LoadingAnimation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReadingRecord, VocabularyItem } from '../types';
import { containsEnglishExpression, normalizeEnglishTerm } from '../utils/englishSearch';
import { replaceReadingTerm } from '../utils/readingVocabulary';
import { useReadingExpressions } from '../hooks/useReadingExpressions';
import { ExpressionSelect } from './ExpressionSelect';
import {basicVocabulary} from '../utils/vocabularyDetails';
import {generateVocabularyDetails} from '../services/vocabularyDetails';

export const ReadingVocabularyEditor: React.FC<{
  reading: ReadingRecord;
  knownVocabulary: VocabularyItem[];
  onSave: (reading: ReadingRecord) => Promise<void>;
  onInspect?: (vocab: VocabularyItem) => void;
}> = ({ reading, knownVocabulary, onSave, onInspect }) => {
  const [term, setTerm] = useState('');
  const [candidate, setCandidate] = useState<VocabularyItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const catalogue = useReadingExpressions(reading);
  const identity = reading.id + ':' + reading.content + ':' + reading.cefrLevel;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  useEffect(() => { setCandidate(null); setError(''); setTerm(''); setMessage(''); setBusy(false); }, [identity]);

  const options = useMemo(() => {
    const items = [...knownVocabulary.filter(item => containsEnglishExpression(reading.content, item.term)),
      ...catalogue.expressions];
    // Current-passage analysis takes precedence over previously saved senses.
    const unique = new Map(items.map(item => [normalizeEnglishTerm(item.term), item]));
    return [...unique.values()].filter(item => item.cefrLevel === reading.cefrLevel)
      .sort((a, b) => a.term.localeCompare(b.term, 'en'));
  }, [catalogue.expressions, knownVocabulary, reading.content, reading.cefrLevel]);

  const lookup = async (value: string) => {
    setTerm(value); setCandidate(null); setError(''); setMessage('');
    if (!value || busy) return;
    const requestedIdentity = identity;
    setBusy(true);
    try {
      if (reading.selectedVocabulary.some(item => normalizeEnglishTerm(item.term) === normalizeEnglishTerm(value))) {
        setMessage('这个表达已在精选词汇中。'); return;
      }
      if(!containsEnglishExpression(reading.content,value))throw new Error('请输入当前短文中出现的英文表达。');
      let details = knownVocabulary.find(item => normalizeEnglishTerm(item.term) === normalizeEnglishTerm(value));
      if (!details) {
        const base = basicVocabulary(value);
        const generated = await generateVocabularyDetails(base);
        details = {...base,details:generated,type:generated.type,category:generated.category,cefrLevel:reading.cefrLevel,phonetic:generated.phoneticUK||generated.phoneticUS,partOfSpeech:generated.senses.map(item=>item.partOfSpeech).filter(Boolean).join(' / '),meaningZh:generated.senses.map(item=>item.meaningZh).join('；'),definitionEn:generated.sections.definitions.map(item=>item.text).join('\n'),example:generated.sections.examples[0]?.text||''};
      }
      if (currentIdentity.current !== requestedIdentity) return;
      if (details.cefrLevel !== reading.cefrLevel) throw new Error('该表达不符合 ' + reading.cefrLevel + ' 程度。');
      const now = Date.now();
      setCandidate({ ...details, id: crypto.randomUUID(), term: details.term || value, type: details.type || 'word',
        phonetic: details.phonetic || '', partOfSpeech: details.partOfSpeech || '', meaningZh: details.meaningZh || '', definitionEn: details.definitionEn || '', example: details.example || '', collocations: details.collocations || [],
        sourceReadingId: reading.id, sourceCefrLevel: reading.cefrLevel, status: 'New', createdAt: now, updatedAt: now, nextReviewDate: now, reviewCount: 0, currentInterval: 0 });
    } catch (err) { if (currentIdentity.current === requestedIdentity) setError(err instanceof Error ? err.message : '查询失败，请重试。'); }
    finally { if (currentIdentity.current === requestedIdentity) setBusy(false); }
  };
  const save = async () => {
    if (!candidate || busy) return;
    setBusy(true); setError('');
    try {
      await onSave(replaceReadingTerm(reading, candidate));
      setCandidate(null); setTerm(''); setMessage('已同步生词本。');
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败，请重试。'); }
    finally { setBusy(false); }
  };
  return <div className="reading-vocabulary-editor space-y-3 font-ui text-[length:var(--type-body)] leading-[1.6]">
    <div className="reading-vocabulary-editor__tool flex flex-wrap gap-3 items-center">
      <ExpressionSelect identity={identity} value={term} disabled={busy} loading={catalogue.loading} onOpen={catalogue.load}
        onChange={value => void lookup(value)} options={options.map(item => ({ term: item.term, type: item.type,
          selected: reading.selectedVocabulary.some(v => normalizeEnglishTerm(v.term) === normalizeEnglishTerm(item.term)) }))} />
      <span className="reading-vocabulary-editor__count text-[var(--accent-vocab)]">已精选 {reading.selectedVocabulary.length} 项</span>
    </div>
    <form className="reading-add-expression" onSubmit={event=>{event.preventDefault();void lookup(term.trim());}}><label>添加文中表达<input aria-label="添加文中表达" value={term} maxLength={160} disabled={busy} onChange={event=>setTerm(event.target.value)}/></label><button type="submit" disabled={busy||!term.trim()}>查询</button></form>
    {catalogue.error && <p role="alert" className="reading-inline-status text-[var(--status-error)]">{catalogue.error} <button onClick={catalogue.retry} className="min-h-11 min-w-11 inline-flex items-center justify-center underline">重试</button></p>}
    <LoadingAnimation active={busy} operation={candidate ? 'wait' : 'search'} label={candidate ? '正在保存…' : '正在查询…'}/>
    {candidate && <div className="reading-vocabulary-editor__candidate p-3 border border-[var(--border-subtle)] rounded-sm space-y-2">
      <p><strong className="type-term">{candidate.term}</strong> · <span className="type-label italic">{candidate.partOfSpeech}</span></p>
      <p className="type-body">{candidate.meaningZh}</p>
      {onInspect && <button type="button" aria-haspopup="dialog" className="min-h-11 underline" onClick={() => onInspect(candidate)}>查看完整释义</button>}
      <button onClick={save} disabled={busy} className="min-h-11 px-3 py-2 bg-[var(--accent-primary)] text-white rounded-sm disabled:opacity-50">添加并同步生词本</button>
    </div>}
    {error && <p role="alert" className="reading-inline-status text-[var(--status-error)]">{error}</p>}
    {message && <p role="status" className="reading-inline-status text-[var(--accent-vocab)]">{message}</p>}
  </div>;
};
