import React, { useEffect, useState } from 'react';
import type { ReadingRecord, VocabularyItem } from '../types';
import { explainVocabularyTerm } from '../services/api';
import { isEnglishTermQuery, normalizeEnglishTerm } from '../utils/englishSearch';
import { replaceReadingTerm } from '../utils/readingVocabulary';

export const ReadingVocabularyEditor: React.FC<{
  reading: ReadingRecord; targetLanguage: string; onSave: (reading: ReadingRecord) => Promise<void>;
}> = ({ reading, targetLanguage, onSave }) => {
  const [query, setQuery] = useState('');
  const [candidate, setCandidate] = useState<VocabularyItem | null>(null);
  const [replaceId, setReplaceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const limit = reading.vocabularyCount || reading.selectedVocabulary.length;
  const full = reading.selectedVocabulary.length >= limit;
  useEffect(() => { setCandidate(null); setReplaceId(''); setError(''); setQuery(''); }, [reading.id, reading.content, reading.cefrLevel]);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !isEnglishTermQuery(query)) return;
    setBusy(true); setError(''); setMessage(''); setCandidate(null);
    try {
      const term = normalizeEnglishTerm(query);
      if (reading.selectedVocabulary.some(v => normalizeEnglishTerm(v.term) === term)) throw new Error('这个表达已在精选词汇中。');
      const details = await explainVocabularyTerm(term, reading.content, targetLanguage, true, { cefrLevel: reading.cefrLevel, requireInReading: true });
      if (details.cefrLevel !== reading.cefrLevel) throw new Error(`该表达不符合 ${reading.cefrLevel} 程度。`);
      const now = Date.now();
      setCandidate({ ...details, id: crypto.randomUUID(), term: details.term || term, type: details.type || 'word',
        phonetic: details.phonetic || '', partOfSpeech: details.partOfSpeech || '', meaningZh: details.meaningZh || '', definitionEn: details.definitionEn || '', example: details.example || '', collocations: details.collocations || [],
        sourceReadingId: reading.id, sourceCefrLevel: reading.cefrLevel, status: 'New', createdAt: now, updatedAt: now, nextReviewDate: now, reviewCount: 0, currentInterval: 0 });
    } catch (err) { setError(err instanceof Error ? err.message : '查询失败，请重试。'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!candidate || busy) return;
    setBusy(true); setError('');
    try {
      await onSave(replaceReadingTerm(reading, candidate, replaceId || undefined));
      setCandidate(null); setQuery(''); setReplaceId(''); setMessage('精选词汇与生词本已同步，可前往复习。');
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败，请重试。'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 font-ui text-sm">
    <form onSubmit={lookup} className="flex flex-wrap gap-2 items-center">
      <input aria-label="搜索当前短文的精选词汇" placeholder="搜索文中的单词、短语或习语…" maxLength={160} value={query} disabled={busy}
        onChange={e => { setQuery(e.target.value); setCandidate(null); setError(''); setMessage(''); }}
        className="min-w-0 flex-1 basis-56 px-3 py-2 border border-[#D4CCBC] rounded-sm bg-transparent" />
      <button disabled={busy || !isEnglishTermQuery(query)} className="px-3 py-2 bg-[#73785E] text-white rounded-sm disabled:opacity-50">{busy ? '处理中…' : '查找'}</button>
      <span className="text-[#5F654D]">{reading.cefrLevel} · {reading.selectedVocabulary.length}/{limit}</span>
    </form>
    {candidate && <div className="p-3 border border-[#D4CCBC] rounded-sm space-y-2">
      <p><strong className="font-editorial text-xl">{candidate.term}</strong> · {candidate.partOfSpeech} · {candidate.cefrLevel}</p>
      <p>{candidate.meaningZh}</p>
      {full && <select aria-label="选择要替换的精选词汇" value={replaceId} disabled={busy} onChange={e => setReplaceId(e.target.value)} className="max-w-full border border-[#D4CCBC] bg-transparent px-2 py-2">
        <option value="">已达 {limit} 项上限，请选择替换项</option>
        {reading.selectedVocabulary.map(v => <option key={v.id} value={v.id}>{v.term}</option>)}
      </select>}
      <button onClick={save} disabled={busy || (full && !replaceId)} className="ml-2 px-3 py-2 bg-[#73785E] text-white rounded-sm disabled:opacity-50">{full ? '替换并同步生词本' : '添加并同步生词本'}</button>
    </div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {message && <p role="status" className="text-[#5F654D]">{message}</p>}
  </div>;
};
