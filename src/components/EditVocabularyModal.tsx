import React, { useMemo, useState } from 'react';
import { Plus, Trash2, X, Sparkles, Loader2 } from 'lucide-react';
import { VocabularyItem } from '../types';
import { explainVocabularyTerm } from '../services/api';
import { getLocalizedVocabMeaning } from '../utils/i18n';

interface EditVocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVocabList: VocabularyItem[];
  readingContent: string;
  onSave: (updatedList: VocabularyItem[]) => void;
  targetLanguage?: string;
}

export const EditVocabularyModal: React.FC<EditVocabularyModalProps> = ({
  isOpen,
  onClose,
  currentVocabList,
  readingContent,
  onSave,
  targetLanguage = 'zh-CN',
}) => {
  const [list, setList] = useState<VocabularyItem[]>(currentVocabList);
  const [newTerm, setNewTerm] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const readingSuggestions = useMemo(() => {
    const query = newTerm.trim().toLowerCase();
    if (!query) return [];

    const tokens = readingContent.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || [];
    const candidates: string[] = [];
    const seen = new Set<string>();

    for (let size = 1; size <= 4; size++) {
      for (let index = 0; index <= tokens.length - size; index++) {
        const candidate = tokens.slice(index, index + size).join(' ');
        const normalized = candidate.toLowerCase();
        if (
          normalized.includes(query) &&
          !seen.has(normalized) &&
          !list.some((item) => item.term.toLowerCase() === normalized)
        ) {
          seen.add(normalized);
          candidates.push(candidate);
        }
      }
    }

    return candidates
      .sort((a, b) => {
        const aNormalized = a.toLowerCase();
        const bNormalized = b.toLowerCase();
        const aRank = aNormalized === query ? 0 : aNormalized.startsWith(query) ? 1 : 2;
        const bRank = bNormalized === query ? 0 : bNormalized.startsWith(query) ? 1 : 2;
        if (aRank !== bRank) return aRank - bRank;
        const wordCountDifference = a.split(' ').length - b.split(' ').length;
        return wordCountDifference || a.length - b.length;
      })
      .slice(0, 8);
  }, [newTerm, readingContent, list]);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#292B25]/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm p-6 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#D4CCBC]">
          <div>
            <h2 className="font-editorial text-2xl font-semibold text-[#292B25]">
              调整重点词汇 (Edit Vocabulary)
            </h2>
            <p className="text-xs text-[#717265] font-ui">
              添加或移除重点学习词汇，正文高亮与复习将同步更新
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Input Bar */}
        <div className="py-4 border-b border-[#D4CCBC] flex items-start gap-2">
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
              className="w-full px-3 py-2 text-sm bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm focus:outline-none focus:border-[#73785E] font-ui text-[#292B25]"
            />

            {isSuggestionOpen && readingSuggestions.length > 0 && (
              <div
                role="listbox"
                className="absolute z-30 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-[#FAF7F2] border border-[#D4CCBC] rounded-sm shadow-lg"
              >
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[#717265] font-ui">
                  来自当前短文
                </p>
                {readingSuggestions.map((suggestion, index) => (
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
                    className={`w-full px-3 py-2 text-left border-t border-[#D4CCBC]/50 transition-colors ${
                      activeSuggestionIndex === index
                        ? 'bg-[#E5DED0] text-[#292B25]'
                        : 'text-[#5F654D] hover:bg-[#E5DED0]/60'
                    }`}
                  >
                    <span className="font-editorial text-base font-semibold">{suggestion}</span>
                    <span className="ml-2 text-[10px] font-ui text-[#717265]">
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
            className="flex items-center gap-1 px-3.5 py-2 bg-[#73785E] text-[#F2EEE4] text-xs font-medium font-ui rounded-sm hover:bg-[#73785E]/90 disabled:opacity-50 transition-colors"
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
          <p className="text-xs uppercase tracking-wider text-[#717265] font-ui mb-2">
            当前词汇 ({list.length})
          </p>

          {list.length === 0 ? (
            <p className="text-sm text-[#A5AA91] font-ui italic py-4 text-center">
              暂无词汇，请在上方添加
            </p>
          ) : (
            list.map((vocab) => (
              <div
                key={vocab.id}
                className="flex items-center justify-between p-2.5 bg-[#E5DED0]/40 border border-[#D4CCBC] rounded-sm text-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-editorial text-base font-semibold text-[#5F654D]">
                      {vocab.term}
                    </span>
                    <span className="text-xs text-[#717265] font-ui">
                      {vocab.partOfSpeech}
                    </span>
                  </div>
                  <p className="text-xs text-[#717265] font-ui mt-0.5">
                    {getLocalizedVocabMeaning(vocab, targetLanguage)}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(vocab.id)}
                  title="移除词汇"
                  className="p-1.5 text-[#717265] hover:text-[#B49379] hover:bg-[#E5DED0] rounded-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#D4CCBC] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-ui text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0] rounded-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#73785E] text-[#F2EEE4] text-xs font-medium font-ui rounded-sm hover:bg-[#73785E]/90 transition-colors"
          >
            保存并同步
          </button>
        </div>
      </div>
    </div>
  );
};
