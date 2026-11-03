import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import type { ReadingRecord, VocabularyItem } from '../types';
import { explainVocabularyTerm } from '../services/api';
import { isEnglishTermQuery, normalizeEnglishTerm } from '../utils/englishSearch';

export function customWordbookItem(details: Partial<VocabularyItem>, reading: ReadingRecord, now: number, id: string): VocabularyItem {
  return { id, term: details.term!, type: details.type || 'word', cefrLevel: details.cefrLevel,
    phonetic: details.phonetic || '', partOfSpeech: details.partOfSpeech || '', meaningZh: details.meaningZh!,
    definitionEn: details.definitionEn!, example: details.example!, collocations: details.collocations || [],
    savedManually: true, sourceReadingId: reading.id, sourceCefrLevel: reading.cefrLevel,
    addedFromReadingIds: [reading.id], wordbookLevels: [reading.cefrLevel],
    status: 'New', createdAt: now, updatedAt: now, nextReviewDate: now, reviewCount: 0, currentInterval: 0 };
}

export function WordbookCustomAdd({ reading, vocabulary, onSave }: {
  reading: ReadingRecord | null; vocabulary: VocabularyItem[]; onSave: (item: VocabularyItem) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [details, setDetails] = useState<Partial<VocabularyItem> | null>(null);
  const [busy, setBusy] = useState<'query' | 'save' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (open) field.current?.focus({ preventScroll: true }); }, [open]);
  const alreadyAdded = !!details && vocabulary.some(word => normalizeEnglishTerm(word.term) === normalizeEnglishTerm(details.term || ''));
  const lookup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || !reading) return;
    if (!isEnglishTermQuery(query.trim())) { setError('请输入英文单词、完整短语或习语。'); return; }
    lock.current = true; setBusy('query'); setError(''); setSuccess(''); setDetails(null);
    try {
      // General dictionary lookup: do not require occurrence in the current passage or force its CEFR level.
      const result = await explainVocabularyTerm(query.trim(), undefined, true, { requireInReading: false });
      if (!result.term || !result.meaningZh || !result.definitionEn || !result.example || normalizeEnglishTerm(result.term) !== normalizeEnglishTerm(query)) throw new Error('词条释义不完整，请检查拼写后重试。');
      if (alive.current) setDetails(result);
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : '查询失败，请重试。'); }
    finally { lock.current = false; if (alive.current) setBusy(null); }
  };
  const save = async () => {
    if (lock.current || !reading || !details || alreadyAdded) return;
    lock.current = true; setBusy('save'); setError('');
    try {
      await onSave(customWordbookItem(details, reading, Date.now(), `vocab_custom_${crypto.randomUUID()}`));
      if (alive.current) setSuccess(`已添加“${details.term}”`);
    } catch { if (alive.current) setError('未能保存词条，请重试。'); }
    finally { lock.current = false; if (alive.current) setBusy(null); }
  };
  return <div className="wordbook-custom-add">
    <button type="button" className="wordbook-custom-toggle" aria-expanded={open} aria-controls="wordbook-custom-panel" disabled={!!busy} onClick={() => setOpen(value => !value)}><Plus size={16} aria-hidden="true"/>自定义添加<ChevronDown size={16} aria-hidden="true" className={open ? 'rotate-180' : ''}/></button>
    {open && <div id="wordbook-custom-panel">
      <p className="wordbook-custom-hint">不限当前短文内容，查词确认后加入当前短文的生词本。{!reading && '请先打开一篇短文。'}</p>
      <form onSubmit={lookup}>
        <label className="sr-only" htmlFor="wordbook-custom-query">自定义单词或短语</label>
        <div className="wordbook-search-capsule"><Search size={18} aria-hidden="true"/><input ref={field} id="wordbook-custom-query" type="search" maxLength={160} value={query} disabled={!!busy} placeholder="输入想添加的英文单词或短语…" onChange={event => { setQuery(event.target.value); setDetails(null); setError(''); setSuccess(''); }}/></div>
        <button className="wordbook-custom-action" type="submit" disabled={!!busy || !reading || !query.trim()}>{busy === 'query' ? '查询中…' : '查询释义'}</button>
      </form>
      {details && <div className="wordbook-custom-result"><div><strong>{details.term}</strong><span>{details.phonetic} {details.cefrLevel}</span></div><p>{details.meaningZh}</p><p lang="en">{details.definitionEn}</p><button type="button" className="wordbook-custom-action" disabled={!!busy || alreadyAdded} onClick={() => void save()}>{busy === 'save' ? '正在添加…' : alreadyAdded ? '已在生词本中' : '加入生词本'}</button></div>}
      {error && <p className="wordbook-error" role="alert">{error}</p>}
      {success && <p className="wordbook-message" role="status">{success}</p>}
    </div>}
  </div>;
}
