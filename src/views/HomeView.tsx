import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, Minus, Plus } from 'lucide-react';
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

  // Settings load asynchronously from local storage. Keep the visible level in
  // sync so Wordbook ranking and the generation form always use the same CEFR.
  useEffect(() => {
    setCefr(settings.cefr);
  }, [settings.cefr]);

  useEffect(() => {
    setStyle(settings.defaultReadingStyle || 'auto');
  }, [settings.defaultReadingStyle]);

  useEffect(() => { setType(settings.defaultReadingType); }, [settings.defaultReadingType]);
  useEffect(() => { setLength(settings.defaultLength); }, [settings.defaultLength]);
  useEffect(() => { setVocabCount(Math.min(20, Math.max(1, settings.vocabularyCount))); }, [settings.vocabularyCount]);

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
        <h1 className="font-editorial text-[length:var(--type-page)] leading-[1.2]   font-semibold text-[var(--text-primary)] tracking-tight">
          What do you want to learn?
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="home-workspace">
        <section className="home-composer bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-sm shadow-sm focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)]/30 transition-colors">
          <label htmlFor="generation-input" className="home-composer__label text-[length:var(--type-label)] leading-[1.4] font-ui font-medium text-[var(--text-primary)]">学习主题或英文词汇</label>
          <textarea
            id="generation-input"
            aria-label="学习主题或英文词汇"
            aria-describedby={specifiedVocabulary ? 'generation-input-preview' : undefined}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="例如：Small talk at work 或 genuine, break the ice"
            className="home-composer__input w-full bg-transparent resize-none border-none outline-none font-ui text-[length:var(--type-body)] leading-[1.6] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] leading-relaxed"
          />

          {specifiedVocabulary && <div id="generation-input-preview" className="type-label mb-3 font-ui text-[var(--text-secondary)] break-words">
            <p role="status">{specifiedVocabulary.length ? `将按词表处理（${specifiedVocabulary.length} 项）：${specifiedVocabulary.join(' · ')}` : '尚未识别到词条，请在分隔符之间输入表达。'}</p>
            <p className="mt-1">逗号、顿号和分号会分隔词条；主题描述请避免这些分隔符。</p>
          </div>}

          <div className="home-composer__footer">
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="home-composer__submit min-h-11 flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] text-[var(--bg-primary)] font-ui text-[length:var(--type-body)] leading-[1.6] font-medium rounded-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? '生成中…' : '生成短文'}</span>
            </button>
          </div>
        </section>

        <section className="home-prompts">
          <div className="home-prompts__list type-label flex flex-wrap items-center gap-1.5 text-[var(--text-secondary)] font-ui">
            {quickPrompts.slice(0, 3).map((prompt, idx) => (
              <button key={idx} type="button" onClick={() => setInput(prompt.label)} className="min-h-11 px-3 bg-[var(--bg-alt)]/60 hover:bg-[var(--bg-alt)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-full transition-colors">
                {prompt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="learning-settings" aria-labelledby="learning-settings-title">
          <h2 id="learning-settings-title" className="type-section font-ui font-semibold">学习参数</h2>
          <div id="cefr-label" className="sr-only">CEFR 难度等级</div>
          <div role="group" aria-labelledby="cefr-label" aria-describedby="cefr-ability-hint" className="learning-levels">
            {(['A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(level => (
              <button key={level} type="button" aria-pressed={cefr === level} disabled={isLoading}
                onClick={() => { setCefr(level); onCefrChange?.(level); }}>
                <span>{level}</span><span>{({ A2: '入门', B1: '进阶', B2: '中高', C1: '高级' })[level]}</span>
              </button>
            ))}
          </div>
          <p id="cefr-ability-hint" className="type-label learning-hint" aria-live="polite">能力参考：{CEFR_ABILITY_HINTS[cefr]}</p>
          <div className="learning-parameters">
            <div className="learning-row">
              <span id="reading-type">文体</span>
              <div className="learning-choices" role="group" aria-labelledby="reading-type">
                {([['story', '故事'], ['dialogue', '对话'], ['non-story', '说明'], ['random', '随机']] as [ReadingType, string][]).map(([value, label]) => (
                  <button type="button" key={value} aria-pressed={type === value} disabled={isLoading} onClick={() => setType(value)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="learning-row">
              <span id="vocab-count-label">精选词汇</span>
              <div className="learning-stepper" role="group" aria-labelledby="vocab-count-label">
                <button type="button" aria-label="减少精选词汇" disabled={isLoading || vocabCount <= 1} onClick={() => setVocabCount(count => Math.max(1, count - 1))}><Minus aria-hidden="true" size={18} /></button>
                <output aria-live="polite" aria-label="精选词汇数量">{vocabCount}</output>
                <button type="button" aria-label="增加精选词汇" disabled={isLoading || vocabCount >= 20} onClick={() => setVocabCount(count => Math.min(20, count + 1))}><Plus aria-hidden="true" size={18} /></button>
                <span>个</span>
              </div>
            </div>
            <div className="learning-row">
              <span id="reading-length">篇幅</span>
              <div className="learning-choices" role="group" aria-labelledby="reading-length">
                {([['short', '短 · 80–120 词'], ['medium', '中 · 150–200 词'], ['long', '长 · 250–350 词']] as [ReadingLength, string][]).map(([value, label]) => (
                  <button type="button" key={value} aria-pressed={length === value} disabled={isLoading} onClick={() => setLength(value)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="learning-row">
              <label htmlFor="reading-style">风格</label>
              <select id="reading-style" value={style} disabled={isLoading} onChange={e => setStyle(e.target.value as ReadingStyle)}>
                {READING_STYLES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
        </section>
      </form>
      {currentReading && onContinueReading && (
        <section className="home-continue" aria-labelledby="continue-reading-title">
          <h2 id="continue-reading-title" className="type-section font-ui">继续上次阅读</h2>
          <button type="button" onClick={onContinueReading} className="home-continue__link">
            <span className="min-w-0">
              <span className="type-term font-editorial block">{currentReading.title}</span>
              <span className="type-label font-ui text-[var(--text-secondary)] block mt-1">{currentReading.cefrLevel} · {currentReading.selectedVocabulary.length} 个精选词汇</span>
            </span>
            <ArrowRight aria-hidden="true" className="w-5 h-5 shrink-0" />
          </button>
        </section>
      )}
    </div>
  );
};
