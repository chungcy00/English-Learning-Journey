import React, { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, Volume2 } from 'lucide-react';
import type { VocabularyItem } from '../types';
import { ReviewFlipCard } from './ReviewFlipCard';

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

/** Head and ratings stay within the card; only the definitions scroll when needed. */
export function PracticeVocabularyCard({ vocab, meaning, exampleTranslation, ratings, revealed, disabled, onFlip, onPronounce }: {
  vocab: VocabularyItem; meaning: string; exampleTranslation?: string; ratings: React.ReactNode;
  revealed: boolean; disabled: boolean; onFlip: () => void; onPronounce: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [natural, setNatural] = useState(false);
  useLayoutEffect(() => {
    setExpanded(false);
    setScrolled(false);
    if (body.current) body.current.scrollTop = 0;
  }, [vocab.id, revealed]);
  useLayoutEffect(() => {
    const node = card.current;
    if (!node || !revealed) return;
    const head = node.querySelector<HTMLElement>('.practice-vocabulary-card__head');
    const footer = node.querySelector<HTMLElement>('.practice-vocabulary-card__footer');
    const navs = [...document.querySelectorAll<HTMLElement>('.app-header, .installed-bottom-nav')];
    const measure = () => {
      const navHeight = navs.reduce((sum, nav) => sum + nav.getBoundingClientRect().height, 0);
      const limit = Math.max(0, (window.visualViewport?.height ?? window.innerHeight) - navHeight - 32);
      node.style.setProperty('--review-card-limit', `${limit}px`);
      const style = getComputedStyle(node);
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      // Very short views / enlarged text use page scrolling rather than a tiny scroll window.
      const required = (head?.offsetHeight ?? 0) + (footer?.offsetHeight ?? 0) + padding + 120;
      setNatural(Number.isFinite(limit) && limit < required);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [head, footer, ...navs].forEach(element => { if (element) observer.observe(element); });
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
      {header(true)}
      <div key={`${vocab.id}-${revealed}`} ref={body} data-flip-ignore className="practice-vocabulary-card__body" tabIndex={0} role="region" aria-label="词汇释义与例句"
        onScroll={event => setScrolled(event.currentTarget.scrollTop > 0)}>
        <section><h4>中文释义</h4><p className="practice-vocabulary-card__meaning">{meaning}</p></section>
        {vocab.definitionEn && <section><h4>英英释义</h4><p>{vocab.definitionEn}</p></section>}
        {vocab.example && <section><h4>例句</h4><div className="practice-vocabulary-card__example"><p>{vocab.example}</p>{exampleTranslation && <p className="practice-vocabulary-card__translation">{exampleTranslation}</p>}</div></section>}
        {!!vocab.collocations?.length && <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} className="practice-vocabulary-card__collocations">
          <summary>常见搭配<ChevronDown aria-hidden="true" size={18} /></summary>
          <ul>{vocab.collocations.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </details>}
      </div>
      <footer data-flip-ignore className="practice-vocabulary-card__footer">{ratings}</footer>
    </div>
  </ReviewFlipCard>;
}
