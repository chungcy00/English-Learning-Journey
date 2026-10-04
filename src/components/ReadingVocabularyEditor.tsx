import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReadingRecord, VocabularyItem } from '../types';
import { explainVocabularyTerm } from '../services/api';
import { containsEnglishExpression, normalizeEnglishTerm } from '../utils/englishSearch';
import { replaceReadingTerm } from '../utils/readingVocabulary';
import { useReadingExpressions } from '../hooks/useReadingExpressions';
import { ExpressionSelect } from './ExpressionSelect';

export const ReadingVocabularyEditor: React.FC<{
  reading: ReadingRecord;
  knownVocabulary: VocabularyItem[];
  targetLanguage: string;
  onSave: (reading: ReadingRecord) => Promise<void>;
}> = ({ reading, knownVocabulary, targetLanguage, onSave }) => {
  const [term, setTerm] = useState('');
  const [candidate, setCandidate] = useState<VocabularyItem | null>(null);
  const [replaceId, setReplaceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const catalogue = useReadingExpressions(reading);
  const identity = reading.id + ':' + reading.content + ':' + reading.cefrLevel;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const limit = reading.vocabularyCount || reading.selectedVocabulary.length;
  const full = reading.selectedVocabulary.length >= limit;
  useEffect(() => { setCandidate(null); setReplaceId(''); setError(''); setTerm(''); setMessage(''); setBusy(false); }, [identity]);

  const options = useMemo(() => {
    const items = [...knownVocabulary.filter(item => containsEnglishExpression(reading.content, item.term)),
      ...catalogue.expressions];
    // Current-passage analysis takes precedence over previously saved senses.
    const unique = new Map(items.map(item => [normalizeEnglishTerm(item.term), item]));
    return [...unique.values()].filter(item => item.cefrLevel === reading.cefrLevel)
      .sort((a, b) => a.term.localeCompare(b.term, 'en'));
  }, [catalogue.expressions, knownVocabulary, reading.content, reading.cefrLevel]);

  const lookup = async (value: string) => {
    setTerm(value); setCandidate(null); setReplaceId(''); setError(''); setMessage('');
    if (!value || busy) return;
    const requestedIdentity = identity;
    setBusy(true);
    try {
      if (reading.selectedVocabulary.some(item => normalizeEnglishTerm(item.term) === normalizeEnglishTerm(value))) {
        setMessage('这个表达已在精选词汇中。'); return;
      }
      const details = await explainVocabularyTerm(value, reading.content, targetLanguage, true, { cefrLevel: reading.cefrLevel, requireInReading: true });
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
      await onSave(replaceReadingTerm(reading, candidate, replaceId || undefined));
      setCandidate(null); setTerm(''); setReplaceId(''); setMessage('已同步生词本。');
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败，请重试。'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 font-ui text-sm">
    <div className="flex flex-wrap gap-3 items-center">
      <ExpressionSelect identity={identity} value={term} disabled={busy} loading={catalogue.loading} onOpen={catalogue.load}
        onChange={value => void lookup(value)} options={options.map(item => ({ term: item.term, type: item.type,
          selected: reading.selectedVocabulary.some(v => normalizeEnglishTerm(v.term) === normalizeEnglishTerm(item.term)) }))} />
      <span className="text-[#5F654D]" aria-label={`当前短文已精选 ${reading.selectedVocabulary.length} 项，上限 ${limit} 项`}>已精选 {reading.selectedVocabulary.length}/{limit} 项</span>
    </div>
    {catalogue.error && <p role="alert" className="text-red-700">{catalogue.error} <button onClick={catalogue.retry} className="min-h-11 min-w-11 inline-flex items-center justify-center underline">重试</button></p>}
    {busy && <p role="status" className="text-[#5F654D]">{candidate ? '正在保存…' : '正在查询…'}</p>}
    {candidate && <div className="p-3 border border-[#D4CCBC] rounded-sm space-y-2">
      <p><strong className="font-editorial text-xl">{candidate.term}</strong> · {candidate.partOfSpeech}</p>
      <p>{candidate.meaningZh}</p>
      {full && <select aria-label="选择要替换的精选词汇" value={replaceId} disabled={busy} onChange={e => setReplaceId(e.target.value)} className="w-full text-base border border-[#D4CCBC] bg-transparent px-2 py-2">
        <option value="">已达 {limit} 项上限，请选择替换项</option>
        {reading.selectedVocabulary.map(v => <option key={v.id} value={v.id}>{v.term}</option>)}
      </select>}
      <button onClick={save} disabled={busy || (full && !replaceId)} className="min-h-11 px-3 py-2 bg-[#62694D] text-white rounded-sm disabled:opacity-50">{full ? '替换并同步生词本' : '添加并同步生词本'}</button>
    </div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {message && <p role="status" className="text-[#5F654D]">{message}</p>}
  </div>;
};
