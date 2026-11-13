import { vocabularyHeadword } from '../utils/vocabularyCase';
import React, { useState } from 'react';
import { X, Bookmark } from 'lucide-react';
import { getLocalizedExampleTranslation } from '../utils/i18n';
import { VocabularyItem, ReadingTranslation } from '../types';
import { useModalDialog } from '../hooks/useModalDialog';
import { useMotionPresence } from '../hooks/useMotionPresence';
import { VocabularyDetailsPanel } from './VocabularyDetailsPanel';

interface WordDetailModalProps {
  vocab: VocabularyItem | null; isOpen: boolean; onClose: () => void; isInWordbook: boolean;
  onToggleWordbook: (vocab: VocabularyItem) => void | Promise<void>;
  currentTranslation?: ReadingTranslation; inline?: boolean; inlineExpanded?: boolean; embedded?: boolean;
  readingContext?: boolean; onBeforePronunciation?: () => void;
}
export const WordDetailModal: React.FC<WordDetailModalProps> = ({ vocab, isOpen, onClose, isInWordbook, onToggleWordbook, inline, embedded, onBeforePronunciation, currentTranslation }) => {
  const { present, closing } = useMotionPresence(isOpen && !!vocab);
  const dialogRef = useModalDialog(present && !inline && !embedded);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!(inline || embedded ? isOpen : present) || !vocab) return null;
  const content = <><header className="reading-word-dialog__header"><h2 id="word-detail-title">{vocabularyHeadword(vocab.term, vocab.partOfSpeech)}</h2><button type="button" aria-label="关闭词汇详情" onClick={onClose}><X size={20}/></button></header>
    <div className="reading-word-dialog__body"><VocabularyDetailsPanel key={vocab.id} vocab={{ ...vocab, translations: { ...vocab.translations, 'zh-CN': { meaning: vocab.meaningZh, exampleTranslation: getLocalizedExampleTranslation(vocab, currentTranslation) } } }} onBeforePronunciation={onBeforePronunciation}/></div>
    <footer className="lexicon-dialog-footer"><button type="button" disabled={saving} aria-pressed={isInWordbook} onClick={async () => { if (saving) return; setSaving(true); setError(''); try { await onToggleWordbook(vocab); } catch { setError('收藏操作失败，请重试。'); } finally { setSaving(false); } }}><Bookmark size={18} fill={isInWordbook ? 'currentColor' : 'none'}/>{isInWordbook ? '取消完整词条收藏' : '收藏完整词条'}</button><p>独立收藏的例句和词组会单独保留。</p>{error && <p role="alert">{error}</p>}</footer></>;
  if (inline || embedded) return <div className="word-detail-inline">{content}</div>;
  return <dialog ref={dialogRef} data-closing={closing || undefined} inert={closing} aria-labelledby="word-detail-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }} className="app-dialog word-detail-dialog reading-word-dialog lexicon-dialog">{content}</dialog>;
};
