import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Trash2,
  Volume2,
  ChevronRight,
  Filter,
  Layers,
  Plus,
  Languages,
  Loader2
} from 'lucide-react';
import { VocabularyItem, VocabStatus, CEFRLevel, ReadingType, ReadingLength, ReadingRecord } from '../types';
import { WordDetailModal } from '../components/WordDetailModal';
import {
  SUPPORTED_LANGUAGES,
  getLocalizedVocabMeaning,
  getLocalizedExampleTranslation,
  getI18nText,
} from '../utils/i18n';
import { explainVocabularyTerm, translateVocabularies } from '../services/api';
import { getEnglishTermMatchRank, isEnglishTermQuery, normalizeEnglishTerm, containsEnglishExpression } from '../utils/englishSearch';
import { compareWordbookEntries, isVocabularyAtLevel } from '../utils/wordbookSort';
import { speakEnglishTerm } from '../utils/speech';
import { useReadingExpressions } from '../hooks/useReadingExpressions';

interface WordbookViewProps {
  vocabularyList: VocabularyItem[];
  readings: ReadingRecord[];
  currentReading: ReadingRecord | null;
  onDeleteVocab: (id: string) => void;
  onUpdateStatus: (id: string, status: VocabStatus) => void;
  onGenerateFromWordbook: (params: {
    selectedTerms: string[];
    cefrLevel: CEFRLevel;
    readingType: ReadingType;
    length: ReadingLength;
  }) => void;
  isGenerating: boolean;
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
  onBatchUpdateVocabularies: (updatedVocabs: VocabularyItem[]) => void;
  currentCefr: CEFRLevel;
  onSaveVocab: (vocab: VocabularyItem) => Promise<void>;
  onOpenReview: () => void;
}

export const WordbookView: React.FC<WordbookViewProps> = ({
  vocabularyList,
  readings,
  currentReading,
  onDeleteVocab,
  onUpdateStatus,
  onGenerateFromWordbook,
  isGenerating,
  targetLanguage,
  onLanguageChange,
  onBatchUpdateVocabularies,
  currentCefr,
  onSaveVocab,
  onOpenReview,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [detailVocab, setDetailVocab] = useState<VocabularyItem | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addedTerm, setAddedTerm] = useState<string | null>(null);
  const catalogue = useReadingExpressions(currentReading);

  useEffect(() => { setSelectedTerms([]); }, [currentCefr]);

  const addToCurrentLevel = async (existing?: VocabularyItem) => {
    if (isAdding) return;
    const term = normalizeEnglishTerm(search);
    if (!existing && (!isEnglishTermQuery(term) || term.length > 160)) return;
    const level = currentReading?.cefrLevel || currentCefr;
    setIsAdding(true);
    setAddError(null);
    setAddedTerm(null);
    try {
      if (!currentReading) throw new Error('请先选择一篇当前短文。');
      const details = await explainVocabularyTerm(existing?.term || term, currentReading.content, targetLanguage, true, { requireInReading: true });
      const now = Date.now();
      const item: VocabularyItem = existing ? { ...existing, ...details } : {
        id: `vocab_custom_${crypto.randomUUID()}`,
        term: details.term || term,
        cefrLevel: details.cefrLevel,
        sourceReadingId: currentReading.id,
        sourceCefrLevel: currentReading.cefrLevel,
        type: details.type || (term.includes(' ') ? 'phrase' : 'word'),
        phonetic: details.phonetic || '',
        partOfSpeech: details.partOfSpeech || (term.includes(' ') ? 'phrase' : 'word'),
        meaningZh: details.meaningZh || '', definitionEn: details.definitionEn || '',
        example: details.example || '', collocations: details.collocations || [],
        status: 'New', createdAt: now, updatedAt: now, nextReviewDate: now,
        reviewCount: 0, currentInterval: 0,
      };
      await onSaveVocab({ ...item, savedManually: true, updatedAt: now, nextReviewDate: now,
        wordbookLevels: [...new Set([...(item.wordbookLevels || []), level])] });
      setAddedTerm(item.term);
      setStatusFilter('All');
      setSearch('');
      setIsSuggestionOpen(true);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : '添加失败，请稍后重试。');
    } finally {
      setIsAdding(false);
    }
  };

  // Auto-translate vocabulary items for the selected target language if needed
  useEffect(() => {
    if (!targetLanguage || targetLanguage === 'zh-CN') return;

    const needsTranslation = vocabularyList.filter(
      (v) => !v.translations?.[targetLanguage]?.meaning
    );

    if (needsTranslation.length === 0) return;

    let isMounted = true;
    setIsTranslating(true);

    const batch = needsTranslation.slice(0, 30);
    translateVocabularies(batch, targetLanguage)
      .then((results) => {
        if (!isMounted || !results || Object.keys(results).length === 0) return;
        const updatedList = vocabularyList.map((item) => {
          const tr = results[item.id] || results[item.term.toLowerCase()];
          if (tr) {
            return {
              ...item,
              translations: {
                ...item.translations,
                [targetLanguage]: tr,
              },
            };
          }
          return item;
        });
        onBatchUpdateVocabularies(updatedList);
      })
      .catch((err) => console.warn('Vocab batch translate failed:', err))
      .finally(() => {
        if (isMounted) setIsTranslating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetLanguage, vocabularyList]);

  // Generation parameters when generating from Wordbook (PRD Section 20)
  const [readingType, setReadingType] = useState<ReadingType>('story');
  const [length, setLength] = useState<ReadingLength>('medium');

  const filterOptions = ['All', 'New', 'Learning', 'Difficult', 'Mastered'];

  const readingById = useMemo(
    () => new Map(readings.map((reading) => [reading.id, reading])),
    [readings]
  );

  const searchSuggestions = useMemo(() => {
    const query = search.trim();
    if (!query || !currentReading) return [];
    const savedCurrentTerms = vocabularyList
      .filter(item => containsEnglishExpression(currentReading.content, item.term) || catalogue.expressions.some(expression => normalizeEnglishTerm(expression.term) === normalizeEnglishTerm(item.term)))
      .map(item => item.term);
    const terms = [...new Set([...catalogue.expressions.map(v => v.term), ...currentReading.selectedVocabulary.map(v => v.term), ...savedCurrentTerms].map(normalizeEnglishTerm))];
    return terms.filter(term => getEnglishTermMatchRank(term, query) !== null)
      .sort((a, b) => getEnglishTermMatchRank(a, query)! - getEnglishTermMatchRank(b, query)! || a.localeCompare(b, 'en')).slice(0, 12)
      .map(term => ({ term, item: currentReading.selectedVocabulary.find(v => normalizeEnglishTerm(v.term) === term) || vocabularyList.find(v => normalizeEnglishTerm(v.term) === term), expression: catalogue.expressions.find(v => normalizeEnglishTerm(v.term) === term) }));
  }, [search, vocabularyList, currentReading, catalogue.expressions]);

  const filtered = useMemo(() => {
    return vocabularyList
      .filter(item =>
        (statusFilter === 'All' || item.status === statusFilter) &&
        isVocabularyAtLevel(item, currentCefr, readingById)
      )
      .sort((a, b) => compareWordbookEntries(a, b, currentCefr, readingById));
  }, [vocabularyList, readingById, statusFilter, currentCefr]);

  const toggleSelect = (term: string) => {
    setSelectedTerms((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term]
    );
  };

  const selectAllFiltered = () => {
    const allTerms = filtered.map((v) => v.term);
    setSelectedTerms(allTerms);
  };

  const clearSelection = () => {
    setSelectedTerms([]);
  };

  const handleGenerate = () => {
    if (selectedTerms.length === 0 || isGenerating) return;
    onGenerateFromWordbook({
      selectedTerms,
      cefrLevel: currentCefr,
      readingType,
      length,
    });
  };

  const playVoice = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    speakEnglishTerm(term);
  };

  const getStatusColor = (status: VocabStatus) => {
    switch (status) {
      case 'New':
        return 'bg-[#73785E]/15 text-[#5F654D] border-[#73785E]/30';
      case 'Learning':
        return 'bg-[#B49379]/15 text-[#B49379] border-[#B49379]/30';
      case 'Difficult':
        return 'bg-[#9E6554]/15 text-[#9E6554] border-[#9E6554]/30';
      case 'Mastered':
        return 'bg-[#73785E] text-[#F2EEE4] border-[#73785E]';
    }
  };

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D4CCBC]">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-[#292B25]">
            {getI18nText(targetLanguage, 'wordbookTitle')}
          </h1>
          {isTranslating && (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-ui text-[#5F654D] animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              {getI18nText(targetLanguage, 'syncingWordbook').replace('{lang}', currentLangObj.native)}
            </span>
          )}
        </div>

        {/* Search Bar & Target Language Picker */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#717265] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              maxLength={160}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setAddError(null);
                setAddedTerm(null);
                setIsSuggestionOpen(true);
                setActiveSuggestionIndex(-1);
              }}
              onFocus={() => { setIsSuggestionOpen(true); catalogue.load(); }}
              onBlur={() => setTimeout(() => setIsSuggestionOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && searchSuggestions.length > 0) {
                  e.preventDefault();
                  setIsSuggestionOpen(true);
                  setActiveSuggestionIndex((current) =>
                    current >= searchSuggestions.length - 1 ? 0 : current + 1
                  );
                } else if (e.key === 'ArrowUp' && searchSuggestions.length > 0) {
                  e.preventDefault();
                  setIsSuggestionOpen(true);
                  setActiveSuggestionIndex((current) =>
                    current <= 0 ? searchSuggestions.length - 1 : current - 1
                  );
                } else if (e.key === 'Escape') {
                  setIsSuggestionOpen(false);
                  setActiveSuggestionIndex(-1);
                } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
                  e.preventDefault();
                  setSearch(searchSuggestions[activeSuggestionIndex].term);
                  setIsSuggestionOpen(true);
                  setActiveSuggestionIndex(-1);
                } else if (e.key === 'Enter' && isEnglishTermQuery(search)) {
                  e.preventDefault();
                  void addToCurrentLevel(vocabularyList.find(v => normalizeEnglishTerm(v.term) === normalizeEnglishTerm(search)));
                }
              }}
              placeholder="搜索当前短文的单词、短语或习语…"
              aria-label="搜索当前短文中的英文单词、短语或习语"
              role="combobox"
              aria-expanded={isSuggestionOpen && searchSuggestions.length > 0}
              aria-autocomplete="list"
              className="w-full pl-9 pr-3 py-2 text-base bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm focus-visible:outline-2 focus-visible:outline-[#5F654D] font-ui text-[#292B25]"
            />

            {isSuggestionOpen && (search.trim() || catalogue.loading || catalogue.error || addError || addedTerm) && (
              <div
                className="absolute z-30 left-0 right-0 top-full mt-1 max-h-72 overflow-y-auto bg-[#FAF7F2] border border-[#D4CCBC] rounded-sm shadow-lg"
              >
                <div role="listbox" aria-label="当前短文中的表达">
                {searchSuggestions.map(({ item, term, expression }, index) => (
                  <button
                    key={term}
                    type="button"
                    role="option"
                    aria-selected={activeSuggestionIndex === index}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearch(term);
                      setIsSuggestionOpen(true);
                      setActiveSuggestionIndex(-1);
                    }}
                    className={`w-full px-3 py-2 text-left border-t border-[#D4CCBC]/50 transition-colors ${
                      activeSuggestionIndex === index
                        ? 'bg-[#E5DED0]'
                        : 'hover:bg-[#E5DED0]/60'
                    }`}
                  >
                    <span className="block font-editorial text-base font-semibold text-[#5F654D]">
                      {term}
                    </span>
                    <span className="block text-[11px] font-ui text-[#717265] truncate">
                      {item ? `${vocabularyList.some(saved => saved.id === item.id) ? '已在生词本 · ' : '当前精选 · '}${getLocalizedVocabMeaning(item, targetLanguage)} · ` : ''}
                      <span className="italic">{item?.type || expression?.type || ''}</span>
                    </span>
                  </button>
                ))}
                </div>
                <div className="p-3 space-y-2 text-sm font-ui">
                  {catalogue.loading && <p role="status">正在识别表达…</p>}
                  {catalogue.error && <p role="alert" className="text-red-700">{catalogue.error} <button onClick={catalogue.retry} className="underline">重试</button></p>}
                  {isEnglishTermQuery(search) && search.trim().length <= 160 && !vocabularyList.some(v => normalizeEnglishTerm(v.term) === normalizeEnglishTerm(search)) && <button type="button" disabled={isAdding} onClick={() => void addToCurrentLevel()} className="border border-[#D4CCBC] rounded-sm px-3 py-1.5 disabled:opacity-50 break-words w-full text-left">
                    {isAdding ? '正在添加…' : `添加 “${search.trim()}”`}
                  </button>}
                  {addError && <p role="alert" className="text-red-700">{addError}</p>}
                  {addedTerm && <p role="status">已添加 “{addedTerm}”。 <button onClick={onOpenReview} className="underline">去复习</button></p>}
                </div>
              </div>
            )}
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-[#F2EEE4] border border-[#D4CCBC] px-2.5 py-1.5 rounded-sm">
            <Languages className="w-3.5 h-3.5 text-[#5F654D]" />
            <select
              value={targetLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="bg-transparent text-xs font-ui font-medium text-[#292B25] focus:outline-none cursor-pointer"
              title="切换单词本释义语言"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.native}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Multi-select Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {filterOptions.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 text-xs font-ui rounded-xs border transition-colors ${
                statusFilter === status
                  ? 'bg-[#73785E] text-[#F2EEE4] border-[#73785E]'
                  : 'bg-[#E5DED0]/50 text-[#717265] border-[#D4CCBC] hover:bg-[#E5DED0]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs font-ui">
          <button
            onClick={selectAllFiltered}
            className="text-[#717265] hover:text-[#292B25] underline"
          >
            全选当前
          </button>
          {selectedTerms.length > 0 && (
            <button
              onClick={clearSelection}
              className="text-[#717265] hover:text-[#292B25] underline"
            >
              取消选择 ({selectedTerms.length})
            </button>
          )}
        </div>
      </div>

      {/* Generate Reading From Wordbook Action Card (PRD Section 20) */}
      {selectedTerms.length > 0 && (
        <div className="bg-[#E5DED0] border border-[#D4CCBC] rounded-sm p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#73785E]" />
              <span className="font-ui text-xs font-semibold text-[#292B25]">
                已选 {selectedTerms.length} 个生词重新生成短文
              </span>
            </div>
            <div className="flex flex-wrap gap-1 text-[11px] font-editorial text-[#5F654D]">
              {selectedTerms.map((t) => (
                <span key={t} className="px-1.5 py-0.5 bg-[#F2EEE4] rounded-xs border border-[#D4CCBC]/50">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#D4CCBC]/60">
            <div className="flex items-center gap-1.5 text-xs font-ui text-[#292B25]">
              <span>类型:</span>
              <select
                value={readingType}
                onChange={(e) => setReadingType(e.target.value as ReadingType)}
                className="px-2 py-1 text-xs bg-[#F2EEE4] border border-[#D4CCBC] rounded-xs"
              >
                <option value="story">Story</option>
                <option value="non-story">Non-story</option>
                <option value="dialogue">Dialogue</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-ui text-[#292B25]">
              <span>篇幅:</span>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as ReadingLength)}
                className="px-2 py-1 text-xs bg-[#F2EEE4] border border-[#D4CCBC] rounded-xs"
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-[#73785E] text-[#F2EEE4] hover:bg-[#73785E]/90 text-xs font-ui font-medium rounded-sm shadow-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>生成新短文 (Generate Reading)</span>
            </button>
          </div>
        </div>
      )}

      {/* Vocabulary List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-[#E5DED0]/20 border border-[#D4CCBC] rounded-sm">
            <p className="font-ui text-sm text-[#717265]">
              当前短文中暂无符合筛选的词条，可搜索并添加文中完整的单词、短语或习语。
            </p>
          </div>
        ) : (
          filtered.map((vocab) => {
            const isSelected = selectedTerms.includes(vocab.term);
            return (
              <div
                key={vocab.id}
                onClick={() => setDetailVocab(vocab)}
                className="group cursor-pointer p-4 bg-[#F2EEE4] hover:bg-[#E5DED0]/40 border border-[#D4CCBC] rounded-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Checkbox & Term Info */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(vocab.term);
                    }}
                    className="mt-1 text-[#717265] hover:text-[#5F654D] transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#5F654D]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-editorial text-xl font-semibold text-[#5F654D] group-hover:text-[#292B25] transition-colors">
                        {vocab.term}
                      </h3>
                      <button
                        onClick={(e) => playVoice(vocab.term, e)}
                        title="发音"
                        className="p-1 text-[#717265] hover:text-[#5F654D] rounded-xs"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-ui italic text-[#717265]">
                        [{vocab.partOfSpeech}]
                      </span>
                    </div>

                    <p className="text-sm font-ui font-medium text-[#292B25] mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{getLocalizedVocabMeaning(vocab, targetLanguage)}</span>
                      {targetLanguage !== 'zh-CN' && vocab.meaningZh && getLocalizedVocabMeaning(vocab, targetLanguage) !== vocab.meaningZh && (
                        <span className="text-xs font-normal text-[#717265]">
                          ({vocab.meaningZh})
                        </span>
                      )}
                    </p>

                    <p className="font-editorial text-lg sm:text-xl leading-relaxed text-[#717265] italic break-words mt-1">
                      "{vocab.example}"
                    </p>
                    {getLocalizedExampleTranslation(vocab, targetLanguage) && (
                      <p className="text-sm font-ui text-[#5F654D] line-clamp-1 mt-0.5">
                        {getLocalizedExampleTranslation(vocab, targetLanguage)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status selector & Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <select
                    value={vocab.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdateStatus(vocab.id, e.target.value as VocabStatus)}
                    className={`text-[11px] font-ui px-2 py-0.5 rounded-xs border focus:outline-none ${getStatusColor(vocab.status)}`}
                  >
                    <option value="New">New</option>
                    <option value="Learning">Learning</option>
                    <option value="Difficult">Difficult</option>
                    <option value="Mastered">Mastered</option>
                  </select>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`从生词本中删除 "${vocab.term}" 吗？`)) {
                        onDeleteVocab(vocab.id);
                      }
                    }}
                    title="删除"
                    className="p-1 text-[#717265] hover:text-[#9E6554] hover:bg-[#E5DED0] rounded-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      <WordDetailModal
        vocab={detailVocab}
        isOpen={!!detailVocab}
        onClose={() => setDetailVocab(null)}
        isInWordbook={true}
        onToggleWordbook={(v) => onDeleteVocab(v.id)}
        targetLanguage={targetLanguage}
      />
    </div>
  );
};
