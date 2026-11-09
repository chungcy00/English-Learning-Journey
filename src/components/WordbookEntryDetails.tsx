import { VocabularyDetailsPanel } from './VocabularyDetailsPanel';
import React, { useEffect, useRef, useState } from 'react';
import { BookmarkMinus } from 'lucide-react';
import type { ReadingRecord, VocabularyItem } from '../types';
import { wordbookExampleTranslation } from '../utils/wordbookDetails';

export function WordbookEntryDetails({ vocab, reading, onRemove }: {
  vocab: VocabularyItem; reading: ReadingRecord | null;
  onRemove?: (vocab: VocabularyItem) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const remove = async () => {
    if (!onRemove || locked.current) return;
    locked.current = true; setPending(true); setError('');
    try { await onRemove(vocab); }
    catch { if (mounted.current) setError('移出未完成，词条已保留，请重试。'); }
    finally { locked.current = false; if (mounted.current) setPending(false); }
  };
  const translation = wordbookExampleTranslation(vocab, reading);
  return <div className="wordbook-entry-details">
    <VocabularyDetailsPanel vocab={{ ...vocab, translations: { ...vocab.translations, 'zh-CN': { meaning: vocab.meaningZh, exampleTranslation: translation } } }}/>
    <div className="wordbook-detail-bookmark" aria-busy={pending}><button type="button" disabled={pending || !onRemove} aria-label={`移出生词本：${vocab.term}`} onClick={() => void remove()}><BookmarkMinus size={17} aria-hidden="true" />{pending ? '正在移出…' : '移出'}</button></div>
    {error && <p role="alert" className="wordbook-detail-error">{error}</p>}
  </div>;
}
