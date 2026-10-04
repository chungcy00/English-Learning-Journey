import React, { useEffect, useState } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { CEFRLevel, ReadingType, ReadingLength, ReadingStyle, AppSettings } from '../types';
import { READING_STYLES } from '../utils/readingStyles';

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
}

export const HomeView: React.FC<HomeViewProps> = ({
  settings,
  onGenerate,
  isLoading,
  onCefrChange,
}) => {
  const [input, setInput] = useState('');
  const [cefr, setCefr] = useState<CEFRLevel>(settings.cefr);
  const [type, setType] = useState<ReadingType>(settings.defaultReadingType);
  const [style, setStyle] = useState<ReadingStyle>(settings.defaultReadingStyle || 'auto');
  const [length, setLength] = useState<ReadingLength>(settings.defaultLength);
  const [vocabCount, setVocabCount] = useState<number>(settings.vocabularyCount);
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

    // Detect if input contains separated vocabulary list (English/Chinese comma, enumeration comma, semicolon)
    const hasDelimiter = /[,，、;；]/.test(input);
    const commaSeparated = hasDelimiter
      ? input.split(/[,，、;；]/).map(s => s.trim()).filter(Boolean)
      : undefined;

    onGenerate({
      input: input.trim(),
      cefrLevel: cefr,
      readingType: type,
      readingStyle: style,
      length,
      vocabularyCount: vocabCount,
      specifiedVocabulary: commaSeparated
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Title section with Editorial Typography */}
      <div className="text-center mb-8 space-y-2">
        <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#292B25] tracking-tight">
          What do you want to learn?
        </h1>
      </div>

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm p-3 sm:p-4 shadow-sm focus-within:border-[#62694D] focus-within:ring-1 focus-within:ring-[#62694D]/30 transition-all">
          <textarea
            aria-label="学习主题或英文词汇"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="输入英文单词 (如 genuine)、词组 (undivided attention)、多个生词 (genuine, considerate, rooted)、中文主题 (雨天里的小惊喜) 或任意学习想法..."
            className="w-full bg-transparent resize-none border-none outline-none font-editorial text-lg sm:text-xl text-[#292B25] placeholder:text-[#646657] placeholder:font-ui placeholder:text-sm leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D4CCBC]/60">
            {/* Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#555848] font-ui">
              <span className="hidden sm:inline">灵感:</span>
              {quickPrompts.slice(0, 3).map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInput(prompt.label)}
                  className="px-2 py-0.5 bg-[#E5DED0]/60 hover:bg-[#E5DED0] text-[#292B25] border border-[#D4CCBC] rounded-xs transition-colors"
                >
                  {prompt.label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-[#62694D] text-[#F2EEE4] font-ui text-sm font-medium rounded-sm hover:bg-[#5F654D] disabled:opacity-50 transition-all shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Reading</span>
            </button>
          </div>
        </div>

        {/* Reading Generation Settings (PRD Section 10) */}
        <div className="bg-[#E5DED0]/30 border border-[#D4CCBC] rounded-sm p-5 space-y-5">
          <div className="flex items-center border-b border-[#D4CCBC]/60 pb-2.5">
            <span className="font-ui text-xs uppercase tracking-wider text-[#555848] font-semibold">
              短文定制参数 (Generation Settings)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* CEFR Level */}
            <div>
              <div id="cefr-label" className="text-xs font-ui font-medium text-[#292B25] block mb-1.5">
                CEFR 难度等级
              </div>
              <div role="group" aria-labelledby="cefr-label" className="grid grid-cols-4 gap-1">
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
            </div>

            {/* Vocabulary Count */}
            <div>
              <div id="vocab-count-label" className="text-xs font-ui font-medium text-[#292B25] block mb-1.5">精选词汇数</div>
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
          <details className="group border-t border-[#D4CCBC]/60 pt-3">
            <summary className="flex min-h-11 items-center justify-between gap-3 cursor-pointer list-none font-ui rounded-xs focus-visible:outline-2 focus-visible:outline-[#5F654D] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[#292B25]">文体、篇幅与风格</span>
                <span className="block mt-1 text-xs leading-relaxed text-[#555848]">{typeSummary} · {lengthSummary} · {styleSummary}</span>
              </span>
              <ChevronDown aria-hidden="true" className="w-4 h-4 shrink-0 text-[#5F654D] group-open:rotate-180" />
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            {/* Reading Type */}
            <div>
              <label htmlFor="reading-type" className="text-xs font-ui font-medium text-[#292B25] block mb-1.5">
                文体类型 (Type)
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
              <label htmlFor="reading-length" className="text-xs font-ui font-medium text-[#292B25] block mb-1.5">
                短文篇幅 (Length)
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
            <label htmlFor="reading-style" className="text-xs font-ui font-medium text-[#292B25] block mb-1.5">短文风格 (Style)</label>
            <select id="reading-style" value={style} disabled={isLoading}
              onChange={e => setStyle(e.target.value as ReadingStyle)}
              className="w-full min-h-11 px-3 py-2 text-base bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm font-ui text-[#292B25] focus-visible:outline-2 focus-visible:outline-[#5F654D]">
              {READING_STYLES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
            </div>
          </details>
        </div>
      </form>

      {/* Learning Flow Steps Hint */}
      <div className="mt-12 pt-8 border-t border-[#D4CCBC]/50">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]/60">
            <span className="font-editorial text-lg text-[#62694D] block font-semibold">01</span>
            <span className="font-ui text-xs text-[#292B25] font-medium block mt-0.5">情境生成</span>
            <span className="font-ui text-[11px] text-[#555848] block mt-0.5">自然叙述与对话</span>
          </div>
          <div className="p-3 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]/60">
            <span className="font-editorial text-lg text-[#62694D] block font-semibold">02</span>
            <span className="font-ui text-xs text-[#292B25] font-medium block mt-0.5">自动 Humanise</span>
            <span className="font-ui text-[11px] text-[#555848] block mt-0.5">祛除模板感长短句</span>
          </div>
          <div className="p-3 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]/60">
            <span className="font-editorial text-lg text-[#62694D] block font-semibold">03</span>
            <span className="font-ui text-xs text-[#292B25] font-medium block mt-0.5">生词与改写</span>
            <span className="font-ui text-[11px] text-[#555848] block mt-0.5">语境记忆与AI反馈</span>
          </div>
          <div className="p-3 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]/60">
            <span className="font-editorial text-lg text-[#62694D] block font-semibold">04</span>
            <span className="font-ui text-xs text-[#292B25] font-medium block mt-0.5">A4 导出打印</span>
            <span className="font-ui text-[11px] text-[#555848] block mt-0.5">学习册随身练习</span>
          </div>
        </div>
      </div>
    </div>
  );
};
