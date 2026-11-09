import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Minus, Plus, Bookmark, Coffee, BriefcaseBusiness, Plane, Sprout, RefreshCw, AlignLeft, ChevronDown, ChevronUp, SlidersHorizontal, Check, X } from 'lucide-react';
import { CEFRLevel, ReadingType, ReadingLength, ReadingStyle, AppSettings, ReadingRecord, GenerationRequest } from '../types';
import { READING_STYLES } from '../utils/readingStyles';
import { CEFR_ABILITY_HINTS, parseSpecifiedVocabulary } from '../utils/generationInput';
import { readGenerationDraft, saveGenerationDraft } from '../utils/generationDraft';
import { useModalDialog } from '../hooks/useModalDialog';
import { useMotionPresence } from '../hooks/useMotionPresence';

const SCENES = [
  { label: '日常', icon: Coffee, groups: [['如何礼貌地拒绝别人', '与新朋友自然地聊天', '在咖啡馆点单'], ['安排一个轻松的周末', '养成晨间好习惯', '给朋友挑选礼物']] },
  { label: '职场', icon: BriefcaseBusiness, groups: [['在会议中提出建议', '如何向同事寻求帮助', '礼貌地表达不同意见'], ['向团队介绍新项目', '与同事轻松寒暄', '安排工作优先级']] },
  { label: '旅行', icon: Plane, groups: [['机场行李遗失', '在酒店办理入住', '向路人询问方向'], ['在当地餐厅点餐', '一次难忘的火车旅行', '分享旅途中的见闻']] },
  { label: '故事', icon: Sprout, groups: [['一次意外的相遇', '雨天里的温暖小事', '改变生活的小决定'], ['一封迟到的信', '旧书店里的秘密', '第一次勇敢地尝试']] },
];
const TYPE_LABELS: [ReadingType, string][] = [['story', '故事'], ['dialogue', '对话'], ['non-story', '说明'], ['random', '随机']];
const LENGTH_LABELS: [ReadingLength, string][] = [['short', '短篇'], ['medium', '中篇'], ['long', '长篇']];

interface HomeViewProps {
  settings: AppSettings;
  onGenerate: (params: GenerationRequest) => void;
  isLoading: boolean;
  onCefrChange?: (level: CEFRLevel) => void;
  currentReading?: ReadingRecord | null;
  onContinueReading?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ settings, onGenerate, isLoading, onCefrChange, currentReading, onContinueReading }) => {
  const [input, setDraftInput] = useState(() => readGenerationDraft());
  const setInput = (value: string) => { saveGenerationDraft(value); setDraftInput(value); };
  const [importMode, setImportMode] = useState(false);
  const [sourceText, setSourceText] = useState(() => readGenerationDraft('transcript'));
  const [sourceTitle, setSourceTitle] = useState('');
  const [cefr, setCefr] = useState<CEFRLevel>(settings.cefr);
  const [type, setType] = useState<ReadingType>(settings.defaultReadingType);
  const [style, setStyle] = useState<ReadingStyle>(settings.defaultReadingStyle || 'auto');
  const [length, setLength] = useState<ReadingLength>(settings.defaultLength);
  const [vocabCount, setVocabCount] = useState(settings.vocabularyCount);
  const [scene, setScene] = useState(0);
  const [groups, setGroups] = useState([0, 0, 0, 0]);
  const [expanded, setExpanded] = useState(true);
  const [styleOpen, setStyleOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const [customStyle, setCustomStyle] = useState('');
  const [useCustomStyle, setUseCustomStyle] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const stylePresence = useMotionPresence(styleOpen);
  const sheet = useModalDialog(stylePresence.present);
  const touchStart = useRef<number | null>(null);
  const specifiedVocabulary = importMode ? undefined : parseSpecifiedVocabulary(input);
  const styleLabel = useCustomStyle ? `自定义：${customStyle}` : READING_STYLES.find(option => option.value === style)!.label;

  useEffect(() => { setCefr(settings.cefr); }, [settings.cefr]);
  useEffect(() => { setStyle(settings.defaultReadingStyle || 'auto'); }, [settings.defaultReadingStyle]);
  useEffect(() => { setType(settings.defaultReadingType); }, [settings.defaultReadingType]);
  useEffect(() => { setLength(settings.defaultLength); }, [settings.defaultLength]);
  useEffect(() => { setVocabCount(Math.min(20, Math.max(1, settings.vocabularyCount))); }, [settings.vocabularyCount]);
  useEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = 'auto';
    textarea.current.style.height = `${Math.max(96, textarea.current.scrollHeight)}px`;
  }, [input, importMode]);
  useEffect(() => {
    if (!stylePresence.present) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [stylePresence.present]);

  const chooseInspiration = (topic: string) => {
    setImportMode(false);
    setInput(topic);
    textarea.current?.focus({ preventScroll: true });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      textarea.current?.animate([{ borderColor: 'var(--studio-border)' }, { borderColor: 'var(--studio-selected)' }], { duration: 180, iterations: 1 });
    }
    textarea.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(importMode ? sourceText.trim() : input.trim()) || sourceText.length > 30000 || isLoading) return;
    onGenerate({ input: importMode ? sourceTitle.trim() || '英文稿改写' : input.trim(), sourceText: importMode ? sourceText.trim() : undefined, cefrLevel: cefr, readingType: type, readingStyle: useCustomStyle ? 'auto' : style, customReadingStyle: useCustomStyle ? customStyle : undefined, length, vocabularyCount: vocabCount, specifiedVocabulary });
  };

  return (
    <div className="page-shell studio-home">
      {currentReading && onContinueReading && <button type="button" className="studio-continue" onClick={onContinueReading} aria-label={`继续阅读：${currentReading.title}`}>
        <span className="studio-continue__eyebrow"><Bookmark size={15} aria-hidden="true" /> CONTINUE READING · 继续阅读</span>
        <strong>{currentReading.title}</strong>
        <span className="studio-continue__meta">{currentReading.cefrLevel} · {TYPE_LABELS.find(([value]) => value === currentReading.readingType)?.[1] || '短文'}</span>
        <span className="studio-continue__action">继续阅读 <ArrowRight size={16} aria-hidden="true" /></span>
      </button>}
      <section className="studio-inspiration" aria-labelledby="inspiration-title">
        <div className="studio-section-heading"><h2 id="inspiration-title">寻找创作灵感</h2><button type="button" className="studio-refresh" disabled={isLoading} onClick={() => setGroups(previous => previous.map((group, index) => index === scene ? (group + 1) % SCENES[scene].groups.length : group))}><RefreshCw size={15} aria-hidden="true" />换一组</button></div>
        <div className="studio-scenes" role="group" aria-label="灵感场景">{SCENES.map(({ label, icon: Icon }, index) => <button type="button" key={label} aria-pressed={scene === index} disabled={isLoading} onClick={() => setScene(index)}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)}</div>
        <div className="studio-topics">{SCENES[scene].groups[groups[scene]].map((topic, index) => <button type="button" key={topic} disabled={isLoading} onClick={() => chooseInspiration(topic)}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{topic}<ArrowRight size={17} aria-hidden="true" /></button>)}</div>
      </section>
      <form className="studio-creation" onSubmit={handleSubmit}>
        <h2>创作你的短文</h2>
        <div className="studio-input-modes" role="group" aria-label="短文来源">
          <button type="button" aria-pressed={!importMode} disabled={isLoading} onClick={() => setImportMode(false)}>自定义主题</button>
          <button type="button" aria-pressed={importMode} disabled={isLoading} onClick={() => setImportMode(true)}>导入英文稿</button>
        </div>
        {importMode ? <section className="studio-composer studio-transcript">
          <label htmlFor="source-title">稿件标题（选填）</label>
          <input id="source-title" value={sourceTitle} maxLength={160} disabled={isLoading} onChange={e => setSourceTitle(e.target.value)} placeholder="例如：TED 演讲标题" />
          <label htmlFor="source-transcript">英文原稿</label>
          <textarea id="source-transcript" value={sourceText} maxLength={30000} rows={8} disabled={isLoading} aria-describedby="transcript-help" onChange={e => { setSourceText(e.target.value); saveGenerationDraft(e.target.value, 'transcript'); }} placeholder="在这里粘贴 TED 稿件或其他英文文章…" />
          <p id="transcript-help" className="studio-input-preview">{sourceText.length.toLocaleString()} / 30,000 字符 · 保留核心观点，按 {cefr} 等级和下方配方改写。生成的词汇将关联到新短文。</p>
        </section> : <section className="studio-composer">
          <label htmlFor="generation-input"><AlignLeft size={17} aria-hidden="true" />自定义主题与要求</label>
          <textarea ref={textarea} id="generation-input" value={input} onChange={e => setInput(e.target.value)} rows={3} disabled={isLoading} aria-describedby={specifiedVocabulary ? 'generation-input-preview' : undefined} placeholder="例如：如何礼貌地拒绝别人，或输入想学习的英文单词…" />
          {specifiedVocabulary && <div id="generation-input-preview" className="studio-input-preview" role="status">{specifiedVocabulary.length ? `将按词表处理（${specifiedVocabulary.length} 项）：${specifiedVocabulary.join(' · ')}` : '尚未识别到词条，请在分隔符之间输入表达。'}<p>逗号、顿号和分号会分隔词条；主题描述请避免这些分隔符。</p></div>}
        </section>}
        <section className="studio-recipe" aria-labelledby="recipe-title">
          <div className="studio-recipe__heading"><h3 id="recipe-title">学习配方</h3><button type="button" aria-expanded={expanded} aria-controls={expanded ? 'recipe-panel' : undefined} onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronUp size={17} /> : <SlidersHorizontal size={16} />}{expanded ? '收起设置' : '自定义参数'}</button></div>
          {expanded && <div id="recipe-panel" className="studio-recipe__panel">
            <div className="studio-recipe__group"><span id="cefr-label">学习等级</span><div className="studio-choices" role="group" aria-labelledby="cefr-label" aria-describedby="cefr-ability-hint">{(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[]).map(level => <button type="button" key={level} aria-pressed={cefr === level} disabled={isLoading} onClick={() => { setCefr(level); onCefrChange?.(level); }}>{level}</button>)}</div><p id="cefr-ability-hint" className="sr-only">能力参考：{CEFR_ABILITY_HINTS[cefr]}</p></div>
            <div className="studio-recipe__group"><span id="reading-type">文体</span><div className="studio-choices" role="group" aria-labelledby="reading-type">{TYPE_LABELS.map(([value, label]) => <button type="button" key={value} aria-pressed={type === value} disabled={isLoading} onClick={() => setType(value)}>{label}</button>)}</div></div>
            <div className="studio-recipe__group"><span id="reading-length">篇幅</span><div className="studio-choices" role="group" aria-labelledby="reading-length">{LENGTH_LABELS.map(([value, label]) => <button type="button" key={value} title={({ short: '80–120 词', medium: '150–200 词', long: '250–350 词' })[value]} aria-pressed={length === value} disabled={isLoading} onClick={() => setLength(value)}>{label}</button>)}</div></div>
            <div className="studio-recipe__inline"><span id="vocab-count-label">精选词汇</span><div className="studio-stepper" role="group" aria-labelledby="vocab-count-label"><button type="button" aria-label="减少精选词汇" disabled={isLoading || vocabCount <= 1} onClick={() => setVocabCount(count => Math.max(1, count - 1))}><Minus size={18} /></button><output aria-live="polite" aria-label="精选词汇数量">{vocabCount}</output><button type="button" aria-label="增加精选词汇" disabled={isLoading || vocabCount >= 20} onClick={() => setVocabCount(count => Math.min(20, count + 1))}><Plus size={18} /></button></div></div>
            <button id="reading-style" type="button" className="studio-style-trigger studio-recipe__inline" aria-haspopup="dialog" disabled={isLoading} onClick={() => setStyleOpen(true)}><span>风格</span><span className="studio-style-label"><span>{styleLabel}</span><ChevronDown size={17} /></span></button>
          </div>}
        </section>
        <button type="submit" className="studio-generate" disabled={!(importMode ? sourceText.trim() : input.trim()) || isLoading}><span>{isLoading ? '生成中…' : importMode ? '改写为学习短文' : '生成专属短文'}</span><ArrowRight size={19} aria-hidden="true" /></button>
      </form>
      <dialog ref={sheet} className={`studio-style-sheet ${stylePresence.closing ? 'is-closing' : ''}`} aria-labelledby="style-sheet-title" onCancel={() => setStyleOpen(false)} onClick={e => { if (e.target === e.currentTarget) { const bounds = e.currentTarget.getBoundingClientRect(); if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) setStyleOpen(false); } }}>
        <div className="studio-sheet-header" onTouchStart={e => { touchStart.current = e.touches[0].clientY; }} onTouchEnd={e => { if (touchStart.current !== null && e.changedTouches[0].clientY - touchStart.current > 70) setStyleOpen(false); touchStart.current = null; }}>
          <div className="studio-sheet-handle" aria-hidden="true" /><div className="studio-section-heading"><h2 id="style-sheet-title">选择写作风格</h2><button type="button" data-dialog-initial-focus aria-label="关闭风格选择" onClick={() => setStyleOpen(false)}><X size={21} /></button></div><p>选择适合这次阅读的表达方式。</p>
        </div>
        <div className="studio-sheet-content"><div className="studio-style-options" role="group" aria-label="预设写作风格">{READING_STYLES.map(option => <button type="button" key={option.value} aria-pressed={!useCustomStyle && style === option.value} onClick={() => { setStyle(option.value); setUseCustomStyle(false); setStyleOpen(false); }}><span>{option.label}</span>{!useCustomStyle && style === option.value && <Check size={20} aria-hidden="true" />}</button>)}</div>
          <button type="button" className="studio-custom-toggle" aria-expanded={customOpen} aria-controls={customOpen ? 'custom-style-editor' : undefined} onClick={() => setCustomOpen(value => !value)}><Plus size={18} />自定义风格…{useCustomStyle && <Check size={18} />}</button>
          {customOpen && <div id="custom-style-editor" className="studio-custom-editor"><label htmlFor="custom-style-input">描述你想要的写作风格</label><textarea id="custom-style-input" value={customDraft} maxLength={500} placeholder="赛博朋克风、莎士比亚戏剧风…" rows={3} onChange={e => setCustomDraft(e.target.value)} onFocus={e => e.currentTarget.scrollIntoView({ block: 'nearest' })} /><button type="button" disabled={!customDraft.trim()} onClick={() => { setCustomStyle(customDraft.trim()); setUseCustomStyle(true); setStyleOpen(false); }}>使用此风格</button></div>}
        </div>
      </dialog>
    </div>
  );
};
