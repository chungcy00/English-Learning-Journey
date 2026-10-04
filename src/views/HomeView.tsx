import React, { useEffect, useState } from 'react';
import { Sparkles, ChevronDown, ArrowRight } from 'lucide-react';
import { CEFRLevel, ReadingType, ReadingLength, ReadingStyle, AppSettings, ReadingRecord } from '../types';
import { READING_STYLES } from '../utils/readingStyles';
import { CEFR_ABILITY_HINTS, parseSpecifiedVocabulary } from '../utils/generationInput';
import { readGenerationDraft, saveGenerationDraft } from '../utils/generationDraft';

interface HomeViewProps {
  settings: AppSettings;
  onGenerate: (params: {
    input: string;
    cefrLevel: CEFRLevel;
    readingType: ReadingType;
    readingStyle: ReadingStyle;
    length: ReadingLength;
    vocabularyCount: number;
    specifiedVocabulary?: string[];
  }) => void;
  isLoading: boolean;
  onCefrChange?: (level: CEFRLevel) => void;
  currentReading?: ReadingRecord | null;
  onContinueReading?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  settings,
  onGenerate,
  isLoading,
  onCefrChange,
  currentReading,
  onContinueReading,
}) => {
  const [input, setDraftInput] = useState(readGenerationDraft);
  const setInput = (value: string) => {
    saveGenerationDraft(value);
    setDraftInput(value);
  };
  const [cefr, setCefr] = useState<CEFRLevel>(settings.cefr);
  const [type, setType] = useState<ReadingType>(settings.defaultReadingType);
  const [style, setStyle] = useState<ReadingStyle>(settings.defaultReadingStyle || 'auto');
  const [length, setLength] = useState<ReadingLength>(settings.defaultLength);
  const [vocabCount, setVocabCount] = useState<number>(settings.vocabularyCount);
  const specifiedVocabulary = parseSpecifiedVocabulary(input);
  const typeSummary = { story: '故事叙述', 'non-story': '说明/生活见解', dialogue: '情境对话', random: '随机文体' }[type];
  const lengthSummary = { short: '80–120 词', medium: '150–200 词', long: '250–350 词' }[length];
  const styleSummary = READING_STYLES.find(option => option.value === style)?.label || READING_STYLES[0].label;

  // Settings load asynchronously from local storage. Keep the visible level in
  // sync so Wordbook ranking and the generation form always use the same CEFR.
  useEffect(() => {
    setCefr(settings.cefr);
  }, [settings.cefr]);

  useEffect(() => {
    setStyle(settings.defaultReadingStyle || 'auto');
  }, [settings.defaultReadingStyle]);

  const quickPrompts = [
    { label: '雨天里的小惊喜', desc: '中文主题' },
    { label: '如何委婉拒绝别人', desc: '中文实用' },
    { label: 'Small talk at work', desc: '职场对话' },
    { label: 'genuine, considerate, rooted, undivided attention', desc: '指定多词' },
    { label: 'Building a meaningful morning routine', desc: '生活短文' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    onGenerate({
      input: input.trim(),
      cefrLevel: cefr,
      readingType: type,
      readingStyle: style,
      length,
      vocabularyCount: vocabCount,
      specifiedVocabulary
    });
  };

  return (
    <div className="page-shell page-shell--focus home-page">
      <div className="home-page__title">
        <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#292B25] tracking-tight">
          What do you want to learn?
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="home-workspace">
        <section className="home-composer bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm shadow-sm focus-within:border-[#62694D] focus-within:ring-1 focus-within:ring-[#62694D]/30 transition-all">
          <label htmlFor="generation-input" className="home-composer__label text-sm font-ui font-medium text-[#292B25]">学习主题或英文词汇</label>
          <textarea
            id="generation-input"
            aria-label="学习主题或英文词汇"
            aria-describedby={specifiedVocabulary ? 'generation-input-preview' : undefined}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="例如：Small talk at work 或 genuine, break the ice"
            className="home-composer__input w-full bg-transparent resize-none border-none outline-none font-editorial text-lg sm:text-xl text-[#292B25] placeholder:text-[#646657] placeholder:font-ui placeholder:text-sm leading-relaxed"
          />

          {specifiedVocabulary && <div id="generation-input-preview" className="type-label mb-3 font-ui text-[#555848] break-words">
            <p role="status">{specifiedVocabulary.length ? `将按词表处理（${specifiedVocabulary.length} 项）：${specifiedVocabulary.join(' · ')}` : '尚未识别到词条，请在分隔符之间输入表达。'}</p>
            <p className="mt-1">逗号、顿号和分号会分隔词条；主题描述请避免这些分隔符。</p>
          </div>}

          <div className="home-composer__footer">
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="home-composer__submit min-h-11 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#62694D] text-[#F2EEE4] font-ui text-sm font-medium rounded-sm hover:bg-[#5F654D] disabled:opacity-50 transition-all shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Reading</span>
            </button>
          </div>
        </section>

        <section className="home-prompts">
          <div className="home-prompts__list type-label flex flex-wrap items-center gap-1.5 text-[#555848] font-ui">
            {quickPrompts.slice(0, 3).map((prompt, idx) => (
              <button key={idx} type="button" onClick={() => setInput(prompt.label)} className="min-h-10 px-3 bg-[#E5DED0]/60 hover:bg-[#E5DED0] text-[#292B25] border border-[#D4CCBC] rounded-full transition-colors">
                {prompt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="home-settings bg-[#E5DED0]/30 border border-[#D4CCBC] rounded-sm">
          <details className="group">
            <summary className="home-settings__summary flex min-h-11 items-center justify-between gap-3 cursor-pointer list-none font-ui rounded-xs focus-visible:outline-2 focus-visible:outline-[#5F654D] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[#292B25]">阅读设置</span>
                <span className="block mt-1 text-sm leading-relaxed text-[#555848]">{cefr} · {typeSummary} · {lengthSummary} · {vocabCount} 个词 · {styleSummary}</span>
              </span>
              <ChevronDown aria-hidden="true" className="w-4 h-4 shrink-0 text-[#5F654D] group-open:rotate-180" />
            </summary>
            <div className="home-settings__body space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* CEFR Level */}
            <div>
              <div id="cefr-label" className="type-label font-ui font-medium text-[#292B25] block mb-1.5">
                CEFR 难度等级
              </div>
              <div role="group" aria-labelledby="cefr-label" aria-describedby="cefr-ability-hint" className="grid grid-cols-4 gap-1">
                {(['A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={cefr === level}
                    onClick={() => {
                      setCefr(level);
                      onCefrChange?.(level);
                    }}
                    className={`min-h-11 py-1.5 text-sm font-ui font-semibold rounded-xs border transition-colors ${
                      cefr === level
                        ? 'bg-[#62694D] text-[#F2EEE4] border-[#62694D]'
                        : 'bg-[#F2EEE4] text-[#555848] border-[#D4CCBC] hover:bg-[#E5DED0]'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p id="cefr-ability-hint" aria-live="polite" className="type-body mt-2 font-ui text-[#555848]">能力参考：{CEFR_ABILITY_HINTS[cefr]}</p>
            </div>

            {/* Vocabulary Count */}
            <div>
              <div id="vocab-count-label" className="type-label font-ui font-medium text-[#292B25] block mb-1.5">精选词汇数</div>
              <div role="group" aria-labelledby="vocab-count-label" className="grid grid-cols-4 gap-1">
                {[5, 6, 8, 10].map((count) => (
                  <button key={count} type="button" aria-pressed={vocabCount === count} onClick={() => setVocabCount(count)}
                    className={`min-h-11 py-1.5 text-sm font-ui font-medium rounded-xs border transition-colors ${vocabCount === count
                      ? 'bg-[#5F654D] text-[#F2EEE4] border-[#5F654D]'
                      : 'bg-[#F2EEE4] text-[#555848] border-[#D4CCBC] hover:bg-[#E5DED0]'}`}>
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            {/* Reading Type */}
            <div>
              <label htmlFor="reading-type" className="type-label font-ui font-medium text-[#292B25] block mb-1.5">
                文体
              </label>
              <select
                id="reading-type"
                value={type}
                onChange={(e) => setType(e.target.value as ReadingType)}
                className="w-full min-h-11 px-2.5 py-1.5 text-base bg-[#F2EEE4] border border-[#D4CCBC] rounded-xs font-ui text-[#292B25] focus:border-[#62694D]"
              >
                <option value="story">Story (故事叙述)</option>
                <option value="non-story">Non-story (说明/生活见解)</option>
                <option value="dialogue">Dialogue (情境对话)</option>
                <option value="random">Random (系统随机优选)</option>
              </select>
            </div>

            {/* Length */}
            <div>
              <label htmlFor="reading-length" className="type-label font-ui font-medium text-[#292B25] block mb-1.5">
                篇幅
              </label>
              <select
                id="reading-length"
                value={length}
                onChange={(e) => setLength(e.target.value as ReadingLength)}
                className="w-full min-h-11 px-2.5 py-1.5 text-base bg-[#F2EEE4] border border-[#D4CCBC] rounded-xs font-ui text-[#292B25] focus:border-[#62694D]"
              >
                <option value="short">Short (80–120 words)</option>
                <option value="medium">Medium (150–200 words)</option>
                <option value="long">Long (250–350 words)</option>
              </select>
            </div>

          <div>
            <label htmlFor="reading-style" className="type-label font-ui font-medium text-[#292B25] block mb-1.5">风格</label>
            <select id="reading-style" value={style} disabled={isLoading}
              onChange={e => setStyle(e.target.value as ReadingStyle)}
              className="w-full min-h-11 px-3 py-2 text-base bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm font-ui text-[#292B25] focus-visible:outline-2 focus-visible:outline-[#5F654D]">
              {READING_STYLES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
            </div>
            </div>
          </details>
        </section>
      </form>
      {currentReading && onContinueReading && (
        <section className="home-continue" aria-labelledby="continue-reading-title">
          <h2 id="continue-reading-title" className="type-label font-ui text-[#555848]">继续上次阅读</h2>
          <button type="button" onClick={onContinueReading} className="home-continue__link">
            <span className="min-w-0">
              <span className="type-term font-editorial block">{currentReading.title}</span>
              <span className="type-label font-ui text-[#555848] block mt-1">{currentReading.cefrLevel} · {currentReading.selectedVocabulary.length} 个精选词汇</span>
            </span>
            <ArrowRight aria-hidden="true" className="w-5 h-5 shrink-0" />
          </button>
        </section>
      )}
    </div>
  );
};
