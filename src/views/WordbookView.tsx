import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Trash2,
  Volume2,
  ChevronRight,
  ChevronDown,
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
  getI18nText,
} from '../utils/i18n';
import { explainVocabularyTerm, translateVocabularies } from '../services/api';
import { getEnglishTermMatchRank, isEnglishTermQuery, normalizeEnglishTerm, containsEnglishExpression } from '../utils/englishSearch';
import { filterSavedVocabulary } from '../utils/savedVocabulary';
import { speakEnglishTerm } from '../utils/speech';
import { useReadingExpressions } from '../hooks/useReadingExpressions';
import { useWideLayout } from '../hooks/useWideLayout';

interface WordbookViewProps {
  vocabularyList: VocabularyItem[];
  readings: ReadingRecord[];
  currentReading: ReadingRecord | null;
  onDeleteVocab: (id: string) => void;
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
  currentReading,
  onDeleteVocab,
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
  const [collectionSearch, setCollectionSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [detailVocab, setDetailVocab] = useState<VocabularyItem | null>(null);
  const isWideLayout = useWideLayout();
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
        addedFromReadingIds: [...new Set([...(item.addedFromReadingIds || []), currentReading.id])],
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

  const filtered = useMemo(() => filterSavedVocabulary(vocabularyList, collectionSearch, statusFilter), [vocabularyList, collectionSearch, statusFilter]);

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

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage) || SUPPORTED_LANGUAGES[0];
  const suggestionPanelVisible = isSuggestionOpen && !!(search.trim() || catalogue.loading || catalogue.error || addError || addedTerm);
  useEffect(() => {
    if (suggestionPanelVisible && activeSuggestionIndex >= 0) {
      document.getElementById(`wordbook-expression-option-${activeSuggestionIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [suggestionPanelVisible, activeSuggestionIndex]);

  return (
    <div className="page-shell page-stack wordbook-page">
      {/* Header */}
      <div className="space-y-5 pb-6 border-b border-[#D4CCBC]">
        <div className="wordbook-heading-row flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="type-page font-editorial font-semibold text-[#292B25]">
            {getI18nText(targetLanguage, 'wordbookTitle')}
          </h1>
          <p className="type-label mt-2 font-ui text-[#555848]">当前短文已添加词条：{vocabularyList.length} 项</p>
          {isTranslating && (
            <span className="type-meta inline-flex items-center gap-1 mt-1 font-ui text-[#5F654D] animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              {getI18nText(targetLanguage, 'syncingWordbook').replace('{lang}', currentLangObj.native)}
            </span>
          )}
        </div>
        <button type="button" onClick={onOpenReview} className="type-label min-h-11 px-4 py-2 rounded-xl bg-[#62694D] text-[#F2EEE4] font-ui hover:bg-[#5F654D]">开始复习</button>
        </div>

        {/* Search Bar & Target Language Picker */}
        <div className="wordbook-search-tools">
          <div className="min-w-0">
            <label htmlFor="wordbook-expression-search" className="type-label block mb-1.5 font-ui text-[#555848]">搜索并添加当前短文的表达</label>
            <div className="relative">
            <Search className="w-4 h-4 text-[#555848] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="wordbook-expression-search"
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
                } else if (e.key === 'Enter' && isSuggestionOpen && searchSuggestions[activeSuggestionIndex]) {
                  e.preventDefault();
                  setSearch(searchSuggestions[activeSuggestionIndex].term);
                  setIsSuggestionOpen(true);
                  setActiveSuggestionIndex(-1);
                } else if (e.key === 'Enter' && isEnglishTermQuery(search)) {
                  e.preventDefault();
                  void addToCurrentLevel(vocabularyList.find(v => normalizeEnglishTerm(v.term) === normalizeEnglishTerm(search)));
                }
              }}
              placeholder="例如：catch up"
              aria-label="搜索并添加当前短文的英文单词、短语或习语"
              role="combobox"
              aria-expanded={suggestionPanelVisible && searchSuggestions.length > 0}
              aria-autocomplete="list"
              aria-controls={suggestionPanelVisible ? 'wordbook-expression-options' : undefined}
              aria-activedescendant={suggestionPanelVisible && searchSuggestions[activeSuggestionIndex] ? `wordbook-expression-option-${activeSuggestionIndex}` : undefined}
              className="w-full pl-9 pr-3 py-2 text-base bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm focus-visible:outline-2 focus-visible:outline-[#5F654D] font-ui text-[#292B25]"
            />

            {suggestionPanelVisible && (
              <div
                className="absolute z-30 left-0 right-0 top-full mt-1 max-h-72 overflow-y-auto bg-[#FAF7F2] border border-[#D4CCBC] rounded-sm shadow-lg"
              >
                <div id="wordbook-expression-options" role="listbox" aria-label="当前短文中的表达">
                {searchSuggestions.map(({ item, term, expression }, index) => (
                  <button
                    key={term}
                    type="button"
                    role="option"
                    id={`wordbook-expression-option-${index}`}
                    tabIndex={-1}
                    aria-selected={activeSuggestionIndex === index}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={() => {
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
                    <span className="type-meta block font-ui text-[#555848] truncate">
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
          </div>

          {/* Language Selector */}
          <div className="select-with-icon justify-self-start sm:justify-self-end">
            <Languages className="w-3.5 h-3.5 text-[#5F654D]" />
            <select
              value={targetLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="type-label bg-transparent min-h-11 max-w-full font-ui font-medium text-[#292B25] focus:outline-none cursor-pointer"
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
      <section className="wordbook-controls" aria-label="筛选生词本">
      <details className="wordbook-saved-search space-y-2 font-ui" open={isWideLayout || undefined}>
        <summary className="min-h-11 flex items-center cursor-pointer type-label text-[#292B25]">筛选已添加词条 <ChevronRight aria-hidden="true" className="w-4 h-4 ml-2" /></summary>
        <label htmlFor="saved-vocabulary-search" className="sr-only">筛选已添加词条</label>
        <input id="saved-vocabulary-search" value={collectionSearch} onChange={event => setCollectionSearch(event.target.value)}
          placeholder="单词、短语或习语"
          className="w-full min-h-11 px-3 py-2 text-base bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm text-[#292B25] placeholder:text-[#646657]" />
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="wordbook-status-filters flex flex-wrap items-center gap-1.5">
          {filterOptions.map((status) => (
            <button
              key={status}
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              className={`type-label min-h-11 shrink-0 whitespace-nowrap px-3 py-1  font-ui rounded-xs border transition-colors ${
                statusFilter === status
                  ? 'bg-[#62694D] text-[#F2EEE4] border-[#62694D]'
                  : 'bg-[#E5DED0]/50 text-[#555848] border-[#D4CCBC] hover:bg-[#E5DED0]'
              }`}
            >
              {status === 'All' ? '全部状态' : status}
            </button>
          ))}
        </div>

        <div className="type-label flex items-center gap-2 font-ui">
          <button
            onClick={selectAllFiltered}
            className="min-h-11 text-[#555848] hover:text-[#292B25] underline"
          >
            全选当前
          </button>
          {selectedTerms.length > 0 && (
            <button
              onClick={clearSelection}
              className="min-h-11 text-[#555848] hover:text-[#292B25] underline"
            >
              取消选择 ({selectedTerms.length})
            </button>
          )}
        </div>
      </div>

      {/* Generate Reading From Wordbook Action Card (PRD Section 20) */}
      </section>

      {/* Vocabulary List */}
      <div className="wordbook-workspace">
      <div className="wordbook-list" role="list" aria-label="已添加词条">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-[#E5DED0]/20 border border-[#D4CCBC] rounded-sm">
            <p className="type-body font-ui text-[#555848]">
              {vocabularyList.length === 0 ? '暂无词条，可在上方搜索添加。' : '没有匹配的词条，请清空筛选文字或选择全部状态。'}
            </p>
          </div>
        ) : (
          filtered.map((vocab) => {
            const isSelected = selectedTerms.includes(vocab.term);
            if (!isWideLayout) {
              const expanded = detailVocab?.id === vocab.id;
              const panelId = `wordbook-details-${vocab.id}`;
              return (
                <div key={vocab.id} role="listitem" className={`wordbook-accordion ${expanded ? 'is-expanded' : ''}`}>
                  <div className="wordbook-accordion-heading">
                    <label className="flex min-h-11 min-w-11 items-center justify-center cursor-pointer">
                      <input type="checkbox" aria-label={`选择 ${vocab.term}`} checked={isSelected} onChange={() => toggleSelect(vocab.term)} className="h-4 w-4 accent-[#5F654D]" />
                    </label>
                    <h3 className="min-w-0 flex-1">
                      <button type="button" id={`${panelId}-toggle`} aria-expanded={expanded} aria-controls={panelId} aria-label={`查看 ${vocab.term} 的词汇释义`} onClick={() => setDetailVocab(expanded ? null : vocab)} className="wordbook-accordion-toggle">
                        <span className="min-w-0 flex-1">
                          <span className="type-term font-editorial font-semibold text-[#5F654D] block break-words">{vocab.term}</span>
                          <span className="type-meta font-ui italic text-[#555848]">{vocab.partOfSpeech} · {vocab.type}</span>
                        </span>
                        <span className="type-meta font-ui text-[#555848] shrink-0">{vocab.status}</span>
                        <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                    </h3>
                  </div>
                  <div id={panelId} role="region" aria-labelledby={`${panelId}-toggle`} hidden={!expanded}>
                    {expanded && <>
                      <WordDetailModal vocab={vocab} isOpen embedded isInWordbook onClose={() => setDetailVocab(null)} onToggleWordbook={v => { onDeleteVocab(v.id); setDetailVocab(null); }} targetLanguage={targetLanguage} />
                    </>}
                  </div>
                </div>
              );
            }
            return (
              <div
                key={vocab.id}
                role="listitem"
                onClick={() => setDetailVocab(vocab)}
                className={`wordbook-entry group cursor-pointer transition-colors ${isWideLayout && vocab.id === (detailVocab?.id || filtered[0]?.id) ? 'is-active' : ''}`}
              >
                {/* Checkbox & Term Info */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <label className="flex min-h-11 min-w-11 items-center justify-center cursor-pointer" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`选择 ${vocab.term}`} checked={isSelected} onChange={() => toggleSelect(vocab.term)} className="h-4 w-4 accent-[#5F654D] cursor-pointer" />
                  </label>

                  <div className="wordbook-entry-copy min-w-0 break-words">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="type-term font-editorial font-semibold text-[#5F654D] group-hover:text-[#292B25] transition-colors">
                        <button type="button" aria-haspopup={isWideLayout ? undefined : 'dialog'} aria-label={`查看 ${vocab.term} 的词汇释义`} onClick={e => { e.stopPropagation(); setDetailVocab(vocab); }} className="font-editorial text-left min-h-11">{vocab.term}</button>
                      </h3>
                      <button
                        onClick={(e) => playVoice(vocab.term, e)}
                        title="发音"
                        aria-label={`播放 ${vocab.term} 的发音`}
                        className="min-h-11 min-w-11 flex items-center justify-center p-2 text-[#555848] hover:text-[#5F654D] rounded-xs"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="type-meta font-ui text-[#555848] flex flex-wrap gap-x-2">
                      {vocab.phonetic && <span>{vocab.phonetic}</span>}
                      <span className="italic">{vocab.partOfSpeech} · {vocab.type}</span>
                    </p>
                    <p className="type-body font-ui font-medium text-[#292B25] mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{getLocalizedVocabMeaning(vocab, targetLanguage)}</span>
                      {targetLanguage !== 'zh-CN' && vocab.meaningZh && getLocalizedVocabMeaning(vocab, targetLanguage) !== vocab.meaningZh && (
                        <span className="text-xs font-normal text-[#555848]">
                          ({vocab.meaningZh})
                        </span>
                      )}
                    </p>

                  </div>
                </div>

                {/* Status selector & Actions */}
                <div className="wordbook-entry-controls flex items-center gap-2">

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteVocab(vocab.id);
                    }}
                    title="删除"
                    aria-label={`移出生词本：${vocab.term}`}
                    className="min-h-11 min-w-11 flex items-center justify-center p-2 text-[#555848] hover:text-[#854C3C] hover:bg-[#E5DED0] rounded-xs transition-colors"
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
      {isWideLayout && <WordDetailModal
        vocab={vocabularyList.find(v => v.id === detailVocab?.id) || (isWideLayout ? filtered[0] : null)}
        isOpen={!!detailVocab || (isWideLayout && filtered.length > 0)}
        inline={isWideLayout}
        inlineExpanded={!!detailVocab}
        onClose={() => setDetailVocab(null)}
        isInWordbook={true}
        onToggleWordbook={(v) => {
          onDeleteVocab(v.id);
          setDetailVocab(null);
        }}
        targetLanguage={targetLanguage}
      />}
      </div>
      {selectedTerms.length > 0 && (
        <div className="wordbook-selection-panel bg-[#E5DED0] border border-[#D4CCBC] rounded-sm p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#62694D]" />
              <span className="type-label font-ui font-semibold text-[#292B25]">
                已选 {selectedTerms.length} 个生词重新生成短文
              </span>
            </div>
            <div className="min-w-0 flex flex-wrap gap-1 text-[11px] font-editorial text-[#5F654D] break-words">
              {selectedTerms.map((t) => (
                <span key={t} className="px-1.5 py-0.5 bg-[#F2EEE4] rounded-xs border border-[#D4CCBC]/50">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#D4CCBC]/60">
            <div className="type-label flex items-center gap-1.5 font-ui text-[#292B25]">
              <span>类型:</span>
              <select
                value={readingType}
                aria-label="生成短文的类型"
                onChange={(e) => setReadingType(e.target.value as ReadingType)}
                className="px-2 py-1 text-xs bg-[#F2EEE4] border border-[#D4CCBC] rounded-xs"
              >
                <option value="story">Story</option>
                <option value="non-story">Non-story</option>
                <option value="dialogue">Dialogue</option>
              </select>
            </div>

            <div className="type-label flex items-center gap-1.5 font-ui text-[#292B25]">
              <span>篇幅:</span>
              <select
                value={length}
                aria-label="生成短文的篇幅"
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
              className="type-label ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-[#62694D] text-[#F2EEE4] hover:bg-[#5F654D] font-ui font-medium rounded-sm shadow-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>生成新短文 (Generate Reading)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
