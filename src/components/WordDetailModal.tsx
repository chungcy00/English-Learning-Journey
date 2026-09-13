import React from 'react';
import { Volume2, Bookmark, Check, X } from 'lucide-react';
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
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  vocab,
  isOpen,
  onClose,
  isInWordbook,
  onToggleWordbook,
  targetLanguage = 'zh-CN',
  currentTranslation,
}) => {
  if (!isOpen || !vocab) return null;

  const playPronunciation = () => {
    speakEnglishTerm(vocab.term);
  };

  const localizedMeaning = getLocalizedVocabMeaning(vocab, targetLanguage, currentTranslation);
  const localizedExample = getLocalizedExampleTranslation(vocab, targetLanguage, currentTranslation);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#292B25]/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm p-6 sm:p-8 shadow-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#D4CCBC] pb-4 mb-5">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#5F654D]">
                {vocab.term}
              </h2>
              <button
                onClick={playPronunciation}
                title="Listen to pronunciation"
                className="p-1.5 rounded-full hover:bg-[#E5DED0] text-[#73785E] transition-colors"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-[#717265] font-ui">
              {vocab.phonetic && <span>{vocab.phonetic}</span>}
              <span>•</span>
              <span className="italic">{vocab.partOfSpeech}</span>
              <span>•</span>
              <span className="capitalize">{vocab.type}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-sm text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-5 text-sm">
          {/* Target Language Meaning */}
          <div>
            <span className="text-xs uppercase tracking-wider text-[#717265] font-ui block mb-1 font-medium">
              {getI18nText(targetLanguage, 'targetMeaningLabel')}
            </span>
            <p className="font-ui text-base font-medium text-[#292B25] bg-[#E5DED0]/50 p-2.5 rounded-sm border border-[#D4CCBC]/50">
              {localizedMeaning || '暂无释义'}
            </p>
          </div>

          {/* English Definition */}
          <div>
            <span className="text-xs uppercase tracking-wider text-[#717265] font-ui block mb-1">
              {getI18nText(targetLanguage, 'enDefinitionLabel')}
            </span>
            <p className="font-editorial text-base text-[#292B25] leading-relaxed">
              {vocab.definitionEn}
            </p>
          </div>

          {/* Example Sentence */}
          <div>
            <span className="text-xs uppercase tracking-wider text-[#717265] font-ui block mb-1">
              {getI18nText(targetLanguage, 'exampleLabel')}
            </span>
            <div className="bg-[#E5DED0]/30 p-3 rounded-sm border-l-2 border-[#73785E] space-y-1.5">
              <p className="font-editorial text-base italic text-[#5F654D]">
                "{vocab.example}"
              </p>
              {localizedExample && (
                <p className="font-ui text-sm text-[#717265] pt-1 border-t border-[#D4CCBC]/40">
                  {localizedExample}
                </p>
              )}
            </div>
          </div>

          {/* Collocations */}
          {vocab.collocations && vocab.collocations.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-[#717265] font-ui block mb-2">
                {getI18nText(targetLanguage, 'collocationsLabel')}
              </span>
              <div className="flex flex-wrap gap-2">
                {vocab.collocations.map((col, idx) => (
                  <span
                    key={idx}
                    className="font-editorial text-xs px-2.5 py-1 bg-[#E5DED0] text-[#292B25] rounded-sm border border-[#D4CCBC]"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-4 border-t border-[#D4CCBC] flex items-center justify-between">
          <button
            onClick={() => onToggleWordbook(vocab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-medium font-ui transition-all ${
              isInWordbook
                ? 'bg-[#5F654D] text-[#F2EEE4] hover:bg-[#5F654D]/90'
                : 'bg-[#73785E] text-[#F2EEE4] hover:bg-[#73785E]/90'
            }`}
          >
            {isInWordbook ? (
              <>
                <Check className="w-4 h-4" />
                <span>{getI18nText(targetLanguage, 'inWordbook')}</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                <span>{getI18nText(targetLanguage, 'addToWordbook')}</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-ui text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0] rounded-sm transition-colors"
          >
            {getI18nText(targetLanguage, 'close')}
          </button>
        </div>
      </div>
    </div>
  );
};
