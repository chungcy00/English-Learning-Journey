import React, { useEffect, useRef, useState } from 'react';
import { useModalDialog } from '../hooks/useModalDialog';
import { useMotionPresence } from '../hooks/useMotionPresence';
import { Volume2, Bookmark, BookmarkMinus, Check, X, ChevronDown } from 'lucide-react';
import { registerModalBack } from '../utils/modalHistory';
import { VocabularyItem, ReadingTranslation } from '../types';
import {
  getI18nText,
  getLocalizedVocabMeaning,
  getLocalizedExampleTranslation,
} from '../utils/i18n';
import { speakEnglishTerm } from '../utils/speech';

interface WordDetailModalProps {
  vocab: VocabularyItem | null;
  isOpen: boolean;
  onClose: () => void;
  isInWordbook: boolean;
  onToggleWordbook: (vocab: VocabularyItem) => void | Promise<void>;
  currentTranslation?: ReadingTranslation;
  inline?: boolean;
  inlineExpanded?: boolean;
  embedded?: boolean;
  readingContext?: boolean;
  onBeforePronunciation?: () => void;
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  vocab,
  isOpen,
  onClose,
  isInWordbook,
  onToggleWordbook,
  currentTranslation,
  inline = false,
  inlineExpanded = false,
  embedded = false,
  readingContext = false,
  onBeforePronunciation,
}) => {
  const { present, closing } = useMotionPresence(isOpen && !!vocab);
  const dialogRef = useModalDialog(present && !inline && !embedded);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [removed, setRemoved] = useState(false);
  const [pronunciationError, setPronunciationError] = useState('');
  const savingRef = useRef(false);
  const operation = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    setSaveError(''); setPronunciationError(''); setRemoved(false);
    operation.current += 1;
    const body = dialogRef.current?.querySelector('.reading-word-dialog__body');
    if (body) body.scrollTop = 0;
  }, [vocab?.id, isOpen]);
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(false), 5000);
    return () => window.clearTimeout(timer);
  }, [removed]);
  useEffect(() => { if (isInWordbook) setRemoved(false); }, [isInWordbook]);
  useEffect(() => {
    if (!readingContext || !isOpen || !vocab) return;
    return registerModalBack(() => closeRef.current());
  }, [readingContext, isOpen, !!vocab]);
  useEffect(() => {
    if (!readingContext || !present) return;
    const page = document.body;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const previous = { overflow: page.style.overflow, position: page.style.position, top: page.style.top, width: page.style.width };
    Object.assign(page.style, { overflow: 'hidden', position: 'fixed', top: `${-scrollY}px`, width: '100%' });
    return () => {
      Object.assign(page.style, previous);
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    };
  }, [readingContext, present]);
  if (!(inline || embedded ? isOpen : present) || !vocab) return null;

  const playPronunciation = () => {
    setPronunciationError('');
    onBeforePronunciation?.();
    const run = operation.current;
    speakEnglishTerm(vocab.term, message => { if (run === operation.current) setPronunciationError(message); });
  };

  const localizedMeaning = getLocalizedVocabMeaning(vocab, currentTranslation);
  const localizedExample = getLocalizedExampleTranslation(vocab, currentTranslation);

  if (readingContext && !inline && !embedded) {
    const toggleSaved = async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      const run = operation.current;
      const wasSaved = isInWordbook;
      setSaving(true); setSaveError('');
      try { await onToggleWordbook(vocab); if (run === operation.current) setRemoved(wasSaved); }
      catch (error) { if (run === operation.current) setSaveError(error instanceof Error ? error.message : '收藏操作失败，请重试。'); }
      finally { savingRef.current = false; setSaving(false); }
    };
    return <dialog ref={dialogRef} data-closing={closing || undefined} inert={closing} aria-labelledby="word-detail-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }} className="app-dialog word-detail-dialog reading-word-dialog">
      <header className="reading-word-dialog__header"><div><div className="reading-word-dialog__title"><h2 id="word-detail-title">{vocab.term}</h2><button type="button" aria-label={`播放 ${vocab.term} 的发音`} onClick={playPronunciation}><Volume2 size={20} /></button></div><div className="reading-word-dialog__meta">{[vocab.phonetic, vocab.partOfSpeech, vocab.type].filter(Boolean).map((value, index) => <React.Fragment key={index}>{index > 0 && <span aria-hidden="true">·</span>}<span>{value}</span></React.Fragment>)}</div></div><button type="button" data-dialog-initial-focus aria-label="关闭词汇详情" onClick={onClose}><X size={21} /></button></header>
      <div className="word-detail-body reading-word-dialog__body" tabIndex={0} aria-label="词汇释义、例句与搭配">
        {pronunciationError && <p role="alert" className="reading-word-dialog__error">{pronunciationError}</p>}
        <section><h3>中文释义</h3><p className="reading-word-dialog__meaning">{localizedMeaning || '暂无释义'}</p></section>
        <section><h3>英英释义</h3><p>{vocab.definitionEn || '暂无英文定义'}</p></section>
        {vocab.example && <section><h3>例句</h3><div className="reading-word-dialog__example"><p>{vocab.example}</p>{localizedExample && <p>{localizedExample}</p>}</div></section>}
        {!!vocab.collocations?.length && <section><h3>常见搭配</h3><div className="reading-word-dialog__collocations">{vocab.collocations.map((item, index) => <span key={index}>{item}</span>)}</div></section>}
      </div>
      <footer className="reading-word-dialog__footer" aria-busy={saving}>{saveError && <p role="alert">{saveError}</p>}{removed && !isInWordbook && <div className="reading-word-dialog__undo"><span role="status">已移出生词本</span><button type="button" disabled={saving} onClick={() => void toggleSaved()}>撤销</button></div>}{isInWordbook && <span><Check size={17} aria-hidden="true" />已加入生词本</span>}<button type="button" disabled={saving} aria-label={`${isInWordbook ? '移出生词本' : '加入生词本'}：${vocab.term}`} className={isInWordbook ? 'is-saved' : ''} onClick={() => void toggleSaved()}>{isInWordbook ? <BookmarkMinus size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}{saving ? '正在保存…' : isInWordbook ? '移出' : '加入生词本'}</button></footer>
    </dialog>;
  }

  const content = (
    <>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 mb-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="word-detail-title" className="type-term font-editorial font-medium text-[var(--accent-vocab)] break-words">
                {vocab.term}
              </h2>
              <button
                onClick={playPronunciation}
                title="Listen to pronunciation"
                aria-label={`播放 ${vocab.term} 的发音`}
                className="min-h-11 min-w-11 flex items-center justify-center p-2 rounded-full hover:bg-[var(--bg-alt)] text-[var(--accent-vocab)] transition-colors shrink-0"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
            <div className="type-label flex flex-wrap items-center gap-2 mt-1 text-[var(--text-secondary)] font-ui">
              {vocab.phonetic && <><span>{vocab.phonetic}</span><span aria-hidden="true">·</span></>}
              <span className="italic">{vocab.partOfSpeech}</span>
              <span>•</span>
              <span className="italic">{vocab.type}</span>
            </div>
          </div>

          {!inline && !embedded && <button
            data-dialog-initial-focus
            aria-label="关闭词汇详情"
            onClick={onClose}
            className="min-h-11 min-w-11 flex items-center justify-center p-2 rounded-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-alt)] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>}
        </div>

        {/* Content Body */}
        <div className="word-detail-body space-y-5 text-[length:var(--type-body)] leading-[1.6]" tabIndex={0} aria-label="词汇释义、例句与搭配">
          {/* Target Language Meaning */}
          <div>
            <span className="text-[length:var(--type-label)] leading-[1.4] uppercase tracking-wider text-[var(--text-secondary)] font-ui block mb-1 font-medium">
              {getI18nText('targetMeaningLabel')}
            </span>
            <p className="font-ui text-[length:var(--type-translation)] leading-[1.6] font-medium text-[var(--text-primary)] bg-[var(--bg-alt)]/50 p-2.5 rounded-sm border border-[var(--border-subtle)]/50">
              {localizedMeaning || '暂无释义'}
            </p>
          </div>

          {/* English Definition */}
          <div>
            <span className="text-[length:var(--type-label)] leading-[1.4] uppercase tracking-wider text-[var(--text-secondary)] font-ui block mb-1">
              {getI18nText('enDefinitionLabel')}
            </span>
            <p className="type-translation font-editorial text-[var(--text-primary)]">
              {vocab.definitionEn}
            </p>
          </div>

          {/* Example Sentence */}
          <div>
            <span className="text-[length:var(--type-label)] leading-[1.4] uppercase tracking-wider text-[var(--text-secondary)] font-ui block mb-1">
              {getI18nText('exampleLabel')}
            </span>
            <div className="bg-[var(--bg-alt)]/30 p-3 rounded-sm border-l border-[var(--accent-primary)] space-y-1.5">
              <p className="type-example font-editorial italic text-[var(--accent-vocab)]">
                "{vocab.example}"
              </p>
              {localizedExample && (
                <p className="type-translation font-ui text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]/40">
                  {localizedExample}
                </p>
              )}
            </div>
          </div>

          {/* Collocations */}
          {vocab.collocations && vocab.collocations.length > 0 && (
            <div>
              <span className="text-[length:var(--type-label)] leading-[1.4] uppercase tracking-wider text-[var(--text-secondary)] font-ui block mb-2">
                {getI18nText('collocationsLabel')}
              </span>
              <div className="flex flex-wrap gap-2">
                {vocab.collocations.map((col, idx) => (
                  <span
                    key={idx}
                    className="type-example font-editorial px-2.5 py-1 bg-[var(--bg-alt)] text-[var(--text-primary)] rounded-sm border border-[var(--border-subtle)]"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="word-detail-actions mt-8 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap gap-3 items-center justify-between">
          {isInWordbook && <span className="type-label flex items-center gap-1 text-[var(--accent-vocab)] font-ui"><Check aria-hidden="true" className="w-4 h-4" />{getI18nText('inWordbook')}</span>}
          <button
            onClick={() => onToggleWordbook(vocab)}
            aria-label={`${isInWordbook ? '移出生词本' : '加入生词本'}：${vocab.term}`}
            className={`type-label flex items-center gap-2 min-h-11 px-4 py-2 rounded-sm  font-medium font-ui transition-colors ${
              isInWordbook
                ? 'bg-[var(--accent-vocab)] text-[var(--bg-primary)] hover:bg-[var(--text-secondary)]'
                : 'bg-[var(--accent-primary)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {isInWordbook ? (
              <>
                <Bookmark aria-hidden="true" className="w-4 h-4" />
                <span>移出生词本</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                <span>{getI18nText('addToWordbook')}</span>
              </>
            )}
          </button>

          {!inline && !embedded && <button
            onClick={onClose}
            className="type-label min-h-11 px-4 py-2 font-ui text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-alt)] rounded-sm transition-colors"
          >
            {getI18nText('close')}
          </button>}
        </div>
    </>
  );
  if (embedded) return <div className="wordbook-accordion-content">{content}</div>;
  return inline ? (
    <aside className="wordbook-detail-panel" aria-label="词条详情">
      <details key={vocab.id} open={inlineExpanded} className="wordbook-detail-disclosure group">
        <summary className="type-term font-editorial flex items-center justify-between gap-3 min-h-11 cursor-pointer">
          <span>{vocab.term}</span><ChevronDown aria-hidden="true" className="w-4 h-4 shrink-0 group-open:rotate-180" />
        </summary>
        <div className="wordbook-detail-content">{content}</div>
      </details>
    </aside>
  ) : (
    <dialog ref={dialogRef} data-closing={closing || undefined} inert={closing} aria-labelledby="word-detail-title" onCancel={event => { event.preventDefault(); onClose(); }} className="app-dialog word-detail-dialog w-[calc(100%_-_2rem)] max-w-lg bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-sm p-6 sm:p-8 shadow-lg m-auto break-words">{content}</dialog>
  );
};
