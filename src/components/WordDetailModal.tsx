import React from 'react';
import { useModalDialog } from '../hooks/useModalDialog';
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
}) => {
  const dialogRef = useModalDialog(isOpen && !!vocab && !inline);
  if (!isOpen || !vocab) return null;

  const playPronunciation = () => {
    speakEnglishTerm(vocab.term);
  };

  const localizedMeaning = getLocalizedVocabMeaning(vocab, targetLanguage, currentTranslation);
  const localizedExample = getLocalizedExampleTranslation(vocab, targetLanguage, currentTranslation);

  const content = (
    <>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#D4CCBC] pb-4 mb-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="word-detail-title" className="type-section font-editorial font-semibold text-[#5F654D] break-words">
                {vocab.term}
              </h2>
              <button
                onClick={playPronunciation}
                title="Listen to pronunciation"
                aria-label={`播放 ${vocab.term} 的发音`}
                className="min-h-11 min-w-11 flex items-center justify-center p-2 rounded-full hover:bg-[#E5DED0] text-[#5F654D] transition-colors shrink-0"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
            <div className="type-label flex flex-wrap items-center gap-2 mt-1 text-[#555848] font-ui">
              {vocab.phonetic && <span>{vocab.phonetic}</span>}
              <span>•</span>
              <span className="italic">{vocab.partOfSpeech}</span>
              <span>•</span>
              <span className="italic">{vocab.type}</span>
            </div>
          </div>

          {!inline && <button
            data-dialog-initial-focus
            aria-label="关闭词汇详情"
            onClick={onClose}
            className="min-h-11 min-w-11 flex items-center justify-center p-2 rounded-sm text-[#555848] hover:text-[#292B25] hover:bg-[#E5DED0] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>}
        </div>

        {/* Content Body */}
        <div className="space-y-5 text-sm">
          {/* Target Language Meaning */}
          <div>
            <span className="text-xs uppercase tracking-wider text-[#555848] font-ui block mb-1 font-medium">
              {getI18nText(targetLanguage, 'targetMeaningLabel')}
            </span>
            <p className="font-ui text-base font-medium text-[#292B25] bg-[#E5DED0]/50 p-2.5 rounded-sm border border-[#D4CCBC]/50">
              {localizedMeaning || '暂无释义'}
            </p>
          </div>

          {/* English Definition */}
          <div>
            <span className="text-xs uppercase tracking-wider text-[#555848] font-ui block mb-1">
              {getI18nText(targetLanguage, 'enDefinitionLabel')}
            </span>
            <p className="type-example font-editorial text-[#292B25]">
              {vocab.definitionEn}
            </p>
          </div>

          {/* Example Sentence */}
          <div>
            <span className="text-xs uppercase tracking-wider text-[#555848] font-ui block mb-1">
              {getI18nText(targetLanguage, 'exampleLabel')}
            </span>
            <div className="bg-[#E5DED0]/30 p-3 rounded-sm border-l border-[#62694D] space-y-1.5">
              <p className="type-example font-editorial italic text-[#5F654D]">
                "{vocab.example}"
              </p>
              {localizedExample && (
                <p className="type-body font-ui text-[#555848] pt-1 border-t border-[#D4CCBC]/40">
                  {localizedExample}
                </p>
              )}
            </div>
          </div>

          {/* Collocations */}
          {vocab.collocations && vocab.collocations.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-[#555848] font-ui block mb-2">
                {getI18nText(targetLanguage, 'collocationsLabel')}
              </span>
              <div className="flex flex-wrap gap-2">
                {vocab.collocations.map((col, idx) => (
                  <span
                    key={idx}
                    className="type-example font-editorial px-2.5 py-1 bg-[#E5DED0] text-[#292B25] rounded-sm border border-[#D4CCBC]"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-4 border-t border-[#D4CCBC] flex flex-wrap gap-3 items-center justify-between">
          {isInWordbook && <span className="type-label flex items-center gap-1 text-[#5F654D] font-ui"><Check aria-hidden="true" className="w-4 h-4" />{getI18nText(targetLanguage, 'inWordbook')}</span>}
          <button
            onClick={() => onToggleWordbook(vocab)}
            aria-label={`${isInWordbook ? '移出生词本' : '加入生词本'}：${vocab.term}`}
            className={`type-label flex items-center gap-2 min-h-11 px-4 py-2 rounded-sm  font-medium font-ui transition-all ${
              isInWordbook
                ? 'bg-[#5F654D] text-[#F2EEE4] hover:bg-[#555848]'
                : 'bg-[#62694D] text-[#F2EEE4] hover:bg-[#5F654D]'
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

          {!inline && <button
            onClick={onClose}
            className="type-label min-h-11 px-4 py-2 font-ui text-[#555848] hover:text-[#292B25] hover:bg-[#E5DED0] rounded-sm transition-colors"
          >
            {getI18nText(targetLanguage, 'close')}
          </button>}
        </div>
    </>
  );
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
    <dialog ref={dialogRef} aria-labelledby="word-detail-title" onCancel={onClose} className="app-dialog word-detail-dialog w-[calc(100%_-_2rem)] max-w-lg bg-[#F2EEE4] text-[#292B25] border border-[#D4CCBC] rounded-sm p-6 sm:p-8 shadow-lg m-auto break-words">{content}</dialog>
  );
};
