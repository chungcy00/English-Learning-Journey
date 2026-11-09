import { categoryLabels } from '../utils/vocabularyDetails';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { RefreshCw, Volume2 } from 'lucide-react';
import type { VocabularyItem } from '../types';
import { ReviewFlipCard } from './ReviewFlipCard';
import { VocabularyDetailsPanel } from './VocabularyDetailsPanel';

function VocabularyHeader({ vocab, back, onPronounce }: {
  vocab: VocabularyItem; back: boolean; onPronounce: () => void;
}) {
  return <header className="practice-vocabulary-card__head">
    <div className="practice-vocabulary-card__header">
      <span className="practice-vocabulary-card__label">{back ? '释义' : vocab.type === 'word' ? '单词' : '短语'}</span>
      <button type="button" aria-label={`播放 ${vocab.term} 的发音`} onClick={onPronounce}><Volume2 aria-hidden="true" size={21} /></button>
    </div>
    <div className="practice-vocabulary-card__content">
      <h3 className="practice-vocabulary-card__term">{vocab.term}</h3>
      {vocab.phonetic && <p className="practice-vocabulary-card__phonetic">{vocab.phonetic}</p>}
      {vocab.partOfSpeech && <p className="practice-vocabulary-card__pos">{vocab.partOfSpeech}</p>}
    </div>
  </header>;
}

/** The compact heading stays visible while the shared learning content scrolls. */
export function PracticeVocabularyCard({ vocab, meaning, exampleTranslation, revealed, disabled, onFlip, onPronounce, onDetailsBusyChange, flipLocked = false }: {
  vocab: VocabularyItem; meaning: string; exampleTranslation?: string;
  revealed: boolean; disabled: boolean; onFlip: () => void; onPronounce: () => void; onDetailsBusyChange?: (busy: boolean) => void; flipLocked?: boolean;
}) {
  const card = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [natural, setNatural] = useState(false);
  useLayoutEffect(() => {
    setScrolled(false);
    if (body.current) body.current.scrollTop = 0;
  }, [vocab.id, revealed]);
  useLayoutEffect(() => {
    const node = card.current;
    if (!node || !revealed) return;
    const head = node.querySelector<HTMLElement>('.practice-vocabulary-card__head');
    const navs = [...document.querySelectorAll<HTMLElement>('.app-header, .installed-bottom-nav')];
    const measure = () => {
      const navHeight = navs.reduce((sum, nav) => sum + nav.getBoundingClientRect().height, 0);
      const limit = Math.max(0, (window.visualViewport?.height ?? window.innerHeight) - navHeight - 32);
      node.style.setProperty('--review-card-limit', `${limit}px`);
      const style = getComputedStyle(node);
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      // Very short views / enlarged text use page scrolling rather than a tiny scroll window.
      const required = (head?.offsetHeight ?? 0) + padding + 120;
      setNatural(Number.isFinite(limit) && limit < required);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [head, ...navs].forEach(element => { if (element) observer.observe(element); });
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer.disconnect(); window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [revealed, vocab.id]);
  const header = (back: boolean) => <VocabularyHeader vocab={vocab} back={back} onPronounce={onPronounce} />;
  const front = <div className="review-flashcard practice-vocabulary-card">
    {header(false)}
    <p className="practice-vocabulary-card__hint"><RefreshCw aria-hidden="true" size={15} />点击卡片翻面</p>
  </div>;
  return <ReviewFlipCard revealed={revealed} disabled={disabled} onFlip={onFlip} front={front}>
    <div ref={card} className={`review-flashcard practice-vocabulary-card practice-vocabulary-card--back${scrolled && !natural ? ' is-scrolled' : ''}${natural ? ' is-natural' : ''}`}>
      <header className="practice-vocabulary-card__head review-lexicon-heading">
        <div><h3 className="practice-vocabulary-card__term">{vocab.term}</h3><p className="lexicon-muted">{categoryLabels[vocab.category || vocab.type] || '词条'} · 已收藏</p></div>
        <button type="button" disabled={disabled || flipLocked} onClick={onFlip}>返回正面</button>
      </header>
      <div key={`${vocab.id}-${revealed}`} ref={body} className="practice-vocabulary-card__body" data-flip-ignore tabIndex={0} role="region" aria-label="词汇六栏学习资料"
        onScroll={event => setScrolled(event.currentTarget.scrollTop > 0)}>
        {revealed && <VocabularyDetailsPanel onInteractionStateChange={onDetailsBusyChange} key={vocab.id} vocab={{ ...vocab, meaningZh: meaning, translations: { ...vocab.translations, 'zh-CN': { meaning, exampleTranslation } } }} />}
      </div>
    </div>
  </ReviewFlipCard>;
}
