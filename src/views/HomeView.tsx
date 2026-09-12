import React, { useState } from 'react';
import { Sparkles, ArrowRight, BookOpen, Layers, Check } from 'lucide-react';
import { CEFRLevel, ReadingType, ReadingLength, AppSettings } from '../types';

interface HomeViewProps {
  settings: AppSettings;
  onGenerate: (params: {
    input: string;
    cefrLevel: CEFRLevel;
    readingType: ReadingType;
    length: ReadingLength;
    vocabularyCount: number;
    specifiedVocabulary?: string[];
  }) => void;
  isLoading: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  settings,
  onGenerate,
  isLoading,
}) => {
  const [input, setInput] = useState('');
  const [cefr, setCefr] = useState<CEFRLevel>(settings.cefr);
  const [type, setType] = useState<ReadingType>(settings.defaultReadingType);
  const [length, setLength] = useState<ReadingLength>(settings.defaultLength);
  const [vocabCount, setVocabCount] = useState<number>(settings.vocabularyCount);

  const quickPrompts = [
    { label: '体贴的男朋友', desc: '中文主题' },
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
        <p className="font-ui text-sm sm:text-base text-[#717265] max-w-xl mx-auto leading-relaxed">
          输入任何中英文单词、词组、学习主题或多个词汇，AI 将自动生成自然、地道的情境阅读。
        </p>
      </div>

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm p-3 sm:p-4 shadow-sm focus-within:border-[#73785E] focus-within:ring-1 focus-within:ring-[#73785E]/30 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="输入英文单词 (如 genuine)、词组 (undivided attention)、多个生词 (genuine, considerate, rooted)、中文主题 (体贴的男朋友) 或任意学习想法..."
            className="w-full bg-transparent resize-none border-none outline-none font-editorial text-lg sm:text-xl text-[#292B25] placeholder:text-[#A5AA91] placeholder:font-ui placeholder:text-sm leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D4CCBC]/60">
            {/* Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#717265] font-ui">
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
              className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-[#73785E] text-[#F2EEE4] font-ui text-sm font-medium rounded-sm hover:bg-[#73785E]/90 disabled:opacity-50 transition-all shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Reading</span>
            </button>
          </div>
        </div>

        {/* Reading Generation Settings (PRD Section 10) */}
        <div className="bg-[#E5DED0]/30 border border-[#D4CCBC] rounded-sm p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-[#D4CCBC]/60 pb-2.5">
            <span className="font-ui text-xs uppercase tracking-wider text-[#717265] font-semibold">
              短文定制参数 (Generation Settings)
            </span>
            <span className="text-[11px] text-[#717265] font-ui italic">
              自动保留 CEFR 难度与生词语境
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* CEFR Level */}
            <div>
              <label className="text-xs font-ui font-medium text-[#292B25] block mb-1.5">
                CEFR 难度等级
              </label>
              <div className="grid grid-cols-4 gap-1">
                {(['A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCefr(level)}
                    className={`py-1.5 text-xs font-ui font-semibold rounded-xs border transition-colors ${
                      cefr === level
                        ? 'bg-[#73785E] text-[#F2EEE4] border-[#73785E]'
                        : 'bg-[#F2EEE4] text-[#717265] border-[#D4CCBC] hover:bg-[#E5DED0]'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Reading Type */}
            <div>
              <label className="text-xs font-ui font-medium text-[#292B25] block mb-1.5">
                文体类型 (Type)
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ReadingType)}
                className="w-full px-2.5 py-1.5 text-xs bg-[#F2EEE4] border border-[#D4CCBC] rounded-xs font-ui text-[#292B25] focus:outline-none focus:border-[#73785E]"
              >
                <option value="story">Story (故事叙述)</option>
                <option value="non-story">Non-story (说明/生活见解)</option>
                <option value="dialogue">Dialogue (情境对话)</option>
                <option value="random">Random (系统随机优选)</option>
              </select>
            </div>

            {/* Length */}
            <div>
              <label className="text-xs font-ui font-medium text-[#292B25] block mb-1.5">
                短文篇幅 (Length)
              </label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as ReadingLength)}
                className="w-full px-2.5 py-1.5 text-xs bg-[#F2EEE4] border border-[#D4CCBC] rounded-xs font-ui text-[#292B25] focus:outline-none focus:border-[#73785E]"
              >
                <option value="short">Short (80–120 words)</option>
                <option value="medium">Medium (150–200 words)</option>
                <option value="long">Long (250–350 words)</option>
              </select>
            </div>

            {/* Vocabulary Count */}
            <div>
              <label className="text-xs font-ui font-medium text-[#292B25] block mb-1.5">
                精选词汇数
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[5, 6, 8, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setVocabCount(count)}
                    className={`py-1.5 text-xs font-ui font-medium rounded-xs border transition-colors ${
                      vocabCount === count
                        ? 'bg-[#5F654D] text-[#F2EEE4] border-[#5F654D]'
                        : 'bg-[#F2EEE4] text-[#717265] border-[#D4CCBC] hover:bg-[#E5DED0]'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Learning Flow Steps Hint */}
      <div className="mt-12 pt-8 border-t border-[#D4CCBC]/50">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]/60">
            <span className="font-editorial text-lg text-[#73785E] block font-semibold">01</span>
            <span className="font-ui text-xs text-[#292B25] font-medium block mt-0.5">情境生成</span>
            <span className="font-ui text-[11px] text-[#717265] block mt-0.5">自然叙述与对话</span>
          </div>
          <div className="p-3 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]/60">
            <span className="font-editorial text-lg text-[#73785E] block font-semibold">02</span>
            <span className="font-ui text-xs text-[#292B25] font-medium block mt-0.5">自动 Humanise</span>
            <span className="font-ui text-[11px] text-[#717265] block mt-0.5">祛除模板感长短句</span>
          </div>
          <div className="p-3 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]/60">
            <span className="font-editorial text-lg text-[#73785E] block font-semibold">03</span>
            <span className="font-ui text-xs text-[#292B25] font-medium block mt-0.5">生词与改写</span>
            <span className="font-ui text-[11px] text-[#717265] block mt-0.5">语境记忆与AI反馈</span>
          </div>
          <div className="p-3 bg-[#F2EEE4] rounded-sm border border-[#D4CCBC]/60">
            <span className="font-editorial text-lg text-[#73785E] block font-semibold">04</span>
            <span className="font-ui text-xs text-[#292B25] font-medium block mt-0.5">A4 导出打印</span>
            <span className="font-ui text-[11px] text-[#717265] block mt-0.5">学习册随身练习</span>
          </div>
        </div>
      </div>
    </div>
  );
};
