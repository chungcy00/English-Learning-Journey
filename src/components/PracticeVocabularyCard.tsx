import { HandOutline, Companion } from './LearningArt';
import React from 'react';
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

/** Both faces participate in normal page scrolling; only the active face is exposed. */
export function PracticeVocabularyCard({ vocab, meaning, exampleTranslation, revealed, disabled, onFlip, onPronounce, onDetailsBusyChange }: {
  vocab: VocabularyItem; meaning: string; exampleTranslation?: string;
  revealed: boolean; disabled: boolean; onFlip: () => void; onPronounce: () => void; onDetailsBusyChange?: (busy: boolean) => void;
}) {
  const header = (back: boolean) => <VocabularyHeader vocab={vocab} back={back} onPronounce={onPronounce} />;
  const front = <div className="review-flashcard practice-vocabulary-card art-anchor"><HandOutline/><Companion pose="hamster-peek" className="review-companion"/>
    {header(false)}
    <p className="practice-vocabulary-card__hint"><RefreshCw aria-hidden="true" size={15} />点击卡片翻面</p>
  </div>;
  return <ReviewFlipCard revealed={revealed} disabled={disabled} onFlip={onFlip} front={front}>
    <div className="review-flashcard practice-vocabulary-card practice-vocabulary-card--back"><HandOutline/>
      <header className="practice-vocabulary-card__head review-lexicon-heading">
        <h3 className="practice-vocabulary-card__term">{vocab.term}</h3>
      </header>
      <div key={`${vocab.id}-${revealed}`} className="practice-vocabulary-card__body" tabIndex={0} role="region" aria-label="词汇六栏学习资料">
        {revealed && <VocabularyDetailsPanel onInteractionStateChange={onDetailsBusyChange} key={vocab.id} vocab={{ ...vocab, meaningZh: meaning, translations: { ...vocab.translations, 'zh-CN': { meaning, exampleTranslation } } }} />}
      </div>
    </div>
  </ReviewFlipCard>;
}
