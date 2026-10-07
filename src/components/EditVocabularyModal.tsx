import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X, Sparkles, Loader2 } from 'lucide-react';
import { VocabularyItem } from '../types';
import { explainVocabularyTerm } from '../services/api';
import { getLocalizedVocabMeaning } from '../utils/i18n';
import { useMotionPresence } from '../hooks/useMotionPresence';
import {
  extractEnglishWords,
  getEnglishTermMatchRank,
  isEnglishTermQuery,
  normalizeEnglishTerm,
} from '../utils/englishSearch';

interface EditVocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVocabList: VocabularyItem[];
  readingId: string;
  readingContent: string;
  onSave: (updatedList: VocabularyItem[]) => void;
  targetLanguage?: string;
}

export const EditVocabularyModal: React.FC<EditVocabularyModalProps> = ({
  isOpen,
  onClose,
  currentVocabList,
  readingId,
  readingContent,
  onSave,
  targetLanguage = 'zh-CN',
}) => {
  const [list, setList] = useState<VocabularyItem[]>(currentVocabList);
  const [newTerm, setNewTerm] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const { present, closing } = useMotionPresence(isOpen);

  const readingSuggestions = useMemo(() => {
    const query = normalizeEnglishTerm(newTerm);
    if (!query || !isEnglishTermQuery(query)) return [];

    const existingTerms = new Set(list.map(item => normalizeEnglishTerm(item.term)));
    const candidates = new Map<string, string>();
    const addCandidate = (candidate: string) => {
      const normalized = normalizeEnglishTerm(candidate);
      if (
        normalized &&
        !existingTerms.has(normalized) &&
        getEnglishTermMatchRank(normalized, query) !== null &&
        !candidates.has(normalized)
      ) {
        candidates.set(normalized, candidate);
      }
    };

    extractEnglishWords(readingContent).forEach(addCandidate);
    list.flatMap(item => item.collocations || []).forEach(addCandidate);

    // Multi-word input may autocomplete a phrase from the same source sentence.
    // Single-word input only returns real words/collocations, not arbitrary n-grams.
    if (query.includes(' ')) {
      const queryWordCount = query.split(' ').length;
      const sentenceTokens = readingContent
        .split(/[.!?\n]+/)
        .map(extractEnglishWords)
        .filter(tokens => tokens.length > 0);

      for (const tokens of sentenceTokens) {
        for (let size = queryWordCount; size <= Math.min(4, queryWordCount + 2); size++) {
          for (let index = 0; index <= tokens.length - size; index++) {
            addCandidate(tokens.slice(index, index + size).join(' '));
          }
        }
      }
    }

    return [...candidates.values()]
      .sort((a, b) => {
        const aRank = getEnglishTermMatchRank(a, query) ?? 9;
        const bRank = getEnglishTermMatchRank(b, query) ?? 9;
        if (aRank !== bRank) return aRank - bRank;
        const wordCountDifference = a.split(' ').length - b.split(' ').length;
        return wordCountDifference || a.localeCompare(b, 'en');
      })
      .slice(0, 8);
  }, [newTerm, readingContent, list]);

  const suggestionPresence = useMotionPresence(isSuggestionOpen && readingSuggestions.length > 0);
  const lastSuggestions = useRef<string[]>([]);
  useEffect(() => { if (readingSuggestions.length) lastSuggestions.current = readingSuggestions; }, [readingSuggestions]);
  const visibleSuggestions = readingSuggestions.length ? readingSuggestions : lastSuggestions.current;

  if (!present) return null;

  const handleRemove = (id: string) => {
    setList(prev => prev.filter(item => item.id !== id));
  };

  const handleAddNewTerm = async () => {
    const term = newTerm.trim();
    if (!term) return;

    if (list.some(v => v.term.toLowerCase() === term.toLowerCase())) {
      alert(`"${term}" 已在重点词汇列表中`);
      return;
    }

    setIsLookingUp(true);
    try {
      const details = await explainVocabularyTerm(term, readingContent, targetLanguage);
      const now = Date.now();
      const newItem: VocabularyItem = {
        id: `vocab_custom_${now}`,
        term: details.term || term,
        type: details.type as 'word' | 'phrase' || (term.includes(' ') ? 'phrase' : 'word'),
        phonetic: details.phonetic || '',
        partOfSpeech: details.partOfSpeech || 'n.',
        meaningZh: details.meaningZh || '自定义词汇',
        definitionEn: details.definitionEn || `The word or phrase "${term}".`,
        example: details.example || `She practiced using "${term}" in this passage.`,
        collocations: details.collocations || [],
        sourceReadingId: readingId,
        status: 'New',
        createdAt: now,
        updatedAt: now,
        nextReviewDate: now,
        reviewCount: 0,
        currentInterval: 0
      };

      setList(prev => [...prev, newItem]);
      setNewTerm('');
      setIsSuggestionOpen(false);
      setActiveSuggestionIndex(-1);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSave = () => {
    onSave(list);
    onClose();
  };

  return (
    <div data-closing={closing || undefined} inert={closing} className="motion-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-primary)]/40 backdrop-blur-xs">
      <div className="motion-modal-panel w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-sm p-6 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="font-editorial text-[length:var(--type-section)] leading-[1.3] font-semibold text-[var(--text-primary)]">
              调整重点词汇 (Edit Vocabulary)
            </h2>
            <p className="text-[length:var(--type-body)] leading-[1.6] text-[var(--text-secondary)] font-ui">
              添加或移除重点学习词汇，正文高亮与复习将同步更新
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-alt)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Input Bar */}
        <div className="py-4 border-b border-[var(--border-subtle)] flex items-start gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => {
                setNewTerm(e.target.value);
                setIsSuggestionOpen(true);
                setActiveSuggestionIndex(-1);
              }}
              onFocus={() => setIsSuggestionOpen(true)}
              onBlur={() => setTimeout(() => setIsSuggestionOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && readingSuggestions.length > 0) {
                  e.preventDefault();
                  setIsSuggestionOpen(true);
                  setActiveSuggestionIndex((current) =>
                    current >= readingSuggestions.length - 1 ? 0 : current + 1
                  );
                } else if (e.key === 'ArrowUp' && readingSuggestions.length > 0) {
                  e.preventDefault();
                  setIsSuggestionOpen(true);
                  setActiveSuggestionIndex((current) =>
                    current <= 0 ? readingSuggestions.length - 1 : current - 1
                  );
                } else if (e.key === 'Escape') {
                  setIsSuggestionOpen(false);
                  setActiveSuggestionIndex(-1);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (isSuggestionOpen && activeSuggestionIndex >= 0) {
                    setNewTerm(readingSuggestions[activeSuggestionIndex]);
                    setIsSuggestionOpen(false);
                    setActiveSuggestionIndex(-1);
                  } else {
                    handleAddNewTerm();
                  }
                }
              }}
              placeholder="输入单词或词组 (如 thoughtful, rooted in)..."
              role="combobox"
              aria-expanded={isSuggestionOpen && readingSuggestions.length > 0}
              aria-autocomplete="list"
              className="w-full px-3 py-2 text-[length:var(--type-body)] leading-[1.6] bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:border-[var(--accent-primary)] font-ui text-[var(--text-primary)]"
            />

            {suggestionPresence.present && (
              <div
                data-closing={suggestionPresence.closing || undefined}
                inert={suggestionPresence.closing}
                aria-hidden={suggestionPresence.closing}
                role="listbox"
                className="absolute z-30 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-[var(--surface-paper)] border border-[var(--border-subtle)] rounded-sm shadow-lg"
              >
                <p className="px-3 pt-2 pb-1 text-[length:var(--type-label)] leading-[1.4] uppercase tracking-wider text-[var(--text-secondary)] font-ui">
                  来自当前短文
                </p>
                {visibleSuggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.toLowerCase()}
                    type="button"
                    role="option"
                    aria-selected={activeSuggestionIndex === index}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setNewTerm(suggestion);
                      setIsSuggestionOpen(false);
                      setActiveSuggestionIndex(-1);
                    }}
                    className={`w-full px-3 py-2 text-left border-t border-[var(--border-subtle)]/50 transition-colors ${
                      activeSuggestionIndex === index
                        ? 'bg-[var(--bg-alt)] text-[var(--text-primary)]'
                        : 'text-[var(--accent-vocab)] hover:bg-[var(--bg-alt)]/60'
                    }`}
                  >
                    <span className="font-editorial text-[length:var(--type-term)] leading-[1.4] font-semibold">{suggestion}</span>
                    <span className="ml-2 text-[length:var(--type-meta)] leading-[1.4] font-ui text-[var(--text-muted)]">
                      {suggestion.includes(' ') ? '短语' : '单词'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAddNewTerm}
            disabled={!newTerm.trim() || isLookingUp}
            className="flex items-center gap-1 px-3.5 py-2 bg-[var(--accent-primary)] text-[var(--bg-primary)] text-[length:var(--type-label)] leading-[1.4] font-medium font-ui rounded-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {isLookingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>添加</span>
          </button>
        </div>

        {/* Current List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          <p className="text-[length:var(--type-label)] leading-[1.4] uppercase tracking-wider text-[var(--text-secondary)] font-ui mb-2">
            当前词汇 ({list.length})
          </p>

          {list.length === 0 ? (
            <p className="text-[length:var(--type-body)] leading-[1.6] text-[var(--text-secondary)] font-ui italic py-4 text-center">
              暂无词汇，请在上方添加
            </p>
          ) : (
            list.map((vocab) => (
              <div
                key={vocab.id}
                className="flex items-center justify-between p-2.5 bg-[var(--bg-alt)]/40 border border-[var(--border-subtle)] rounded-sm text-[length:var(--type-body)] leading-[1.6]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-editorial text-[length:var(--type-term)] leading-[1.4] font-semibold text-[var(--accent-vocab)]">
                      {vocab.term}
                    </span>
                    <span className="text-[length:var(--type-meta)] leading-[1.4] text-[var(--text-muted)] font-ui">
                      {vocab.partOfSpeech}
                    </span>
                  </div>
                  <p className="text-[length:var(--type-translation)] leading-[1.6] text-[var(--text-secondary)] font-ui mt-0.5">
                    {getLocalizedVocabMeaning(vocab, targetLanguage)}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(vocab.id)}
                  title="移除词汇"
                  className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--status-warning)] hover:bg-[var(--bg-alt)] rounded-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[length:var(--type-label)] leading-[1.4] font-ui text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-alt)] rounded-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-primary)] text-[length:var(--type-label)] leading-[1.4] font-medium font-ui rounded-sm hover:bg-[var(--accent-hover)] transition-colors"
          >
            保存并同步
          </button>
        </div>
      </div>
    </div>
  );
};
