import { VocabularyDetailsPanel } from './VocabularyDetailsPanel';
import React, { useEffect, useRef, useState } from 'react';
import { BookmarkMinus, Check, Volume2 } from 'lucide-react';
import type { ReadingRecord, VocabularyItem, VocabStatus } from '../types';
import { getLocalizedVocabMeaning } from '../utils/i18n';
import { wordbookExampleTranslation } from '../utils/wordbookDetails';
import { speakEnglishTerm } from '../utils/speech';
import { VocabularyStatusSelect } from './VocabularyStatusSelect';

export function WordbookEntryDetails({ vocab, reading, onRemove, onUpdateStatus }: {
  vocab: VocabularyItem; reading: ReadingRecord | null;
  onRemove?: (vocab: VocabularyItem) => Promise<void>;
  onUpdateStatus: (id: string, status: VocabStatus) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [speechError, setSpeechError] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const pronounce = () => {
    setSpeechError('');
    speakEnglishTerm(vocab.term, message => { if (mounted.current) setSpeechError(message); });
  };
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
    <div className="wordbook-detail-bookmark" aria-busy={pending}><span><Check size={17} aria-hidden="true" />已加入生词本</span><button type="button" disabled={pending || !onRemove} aria-label={`移出生词本：${vocab.term}`} onClick={() => void remove()}><BookmarkMinus size={17} aria-hidden="true" />{pending ? '正在移出…' : '移出'}</button></div>
    <p className="lexicon-muted">独立收藏的例句和词组会单独保留。</p>
    {error && <p role="alert" className="wordbook-detail-error">{error}</p>}
    <div className="wordbook-detail-status"><span>学习状态</span><VocabularyStatusSelect vocab={vocab} onUpdate={onUpdateStatus} /></div>
  </div>;
}
