import React from 'react';
import { useModalDialog } from '../hooks/useModalDialog';
import { useMotionPresence } from '../hooks/useMotionPresence';
import { Volume2, Bookmark, Check, X, ChevronDown } from 'lucide-react';
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
  onToggleWordbook: (vocab: VocabularyItem) => void;
  targetLanguage?: string;
  currentTranslation?: ReadingTranslation;
  inline?: boolean;
  inlineExpanded?: boolean;
  embedded?: boolean;
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  vocab,
  isOpen,
  onClose,
  isInWordbook,
  onToggleWordbook,
  targetLanguage = 'zh-CN',
  currentTranslation,
  inline = false,
  inlineExpanded = false,
  embedded = false,
}) => {
  const { present, closing } = useMotionPresence(isOpen && !!vocab);
  const dialogRef = useModalDialog(present && !inline && !embedded);
  if (!(inline || embedded ? isOpen : present) || !vocab) return null;

  const playPronunciation = () => {
    speakEnglishTerm(vocab.term);
  };

  const localizedMeaning = getLocalizedVocabMeaning(vocab, targetLanguage, currentTranslation);
  const localizedExample = getLocalizedExampleTranslation(vocab, targetLanguage, currentTranslation);

  const content = (
    <>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 mb-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="word-detail-title" className="type-section font-editorial font-semibold text-[var(--accent-vocab)] break-words">
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
              {getI18nText(targetLanguage, 'targetMeaningLabel')}
            </span>
            <p className="font-ui text-[length:var(--type-translation)] leading-[1.6] font-medium text-[var(--text-primary)] bg-[var(--bg-alt)]/50 p-2.5 rounded-sm border border-[var(--border-subtle)]/50">
              {localizedMeaning || '暂无释义'}
            </p>
          </div>

          {/* English Definition */}
          <div>
            <span className="text-[length:var(--type-label)] leading-[1.4] uppercase tracking-wider text-[var(--text-secondary)] font-ui block mb-1">
              {getI18nText(targetLanguage, 'enDefinitionLabel')}
            </span>
            <p className="text-[length:var(--type-body)] leading-[1.6] font-editorial text-[var(--text-primary)]">
              {vocab.definitionEn}
            </p>
          </div>

          {/* Example Sentence */}
          <div>
            <span className="text-[length:var(--type-label)] leading-[1.4] uppercase tracking-wider text-[var(--text-secondary)] font-ui block mb-1">
              {getI18nText(targetLanguage, 'exampleLabel')}
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
                {getI18nText(targetLanguage, 'collocationsLabel')}
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
          {isInWordbook && <span className="type-label flex items-center gap-1 text-[var(--accent-vocab)] font-ui"><Check aria-hidden="true" className="w-4 h-4" />{getI18nText(targetLanguage, 'inWordbook')}</span>}
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
                <span>{getI18nText(targetLanguage, 'addToWordbook')}</span>
              </>
            )}
          </button>

          {!inline && !embedded && <button
            onClick={onClose}
            className="type-label min-h-11 px-4 py-2 font-ui text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-alt)] rounded-sm transition-colors"
          >
            {getI18nText(targetLanguage, 'close')}
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
