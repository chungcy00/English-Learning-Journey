import { VocabularyItem, RewritePracticeItem, ReadingTranslation } from '../types';

const CHINESE_STRINGS: Record<string, string> = {


    wordbookTitle: '个人生词本 (My Wordbook)',
    reviewTitle: '词汇复习 (Vocabulary Review)',
  
    vocabSectionTitle: '精选生词与短语 (Selected Vocabulary)',
    addToWordbook: '加入生词本',
    inWordbook: '已在生词本',
    targetMeaningLabel: '母语地道释义',
    enDefinitionLabel: '英文释义',
    exampleLabel: '例句',
    collocationsLabel: '常见搭配',
    exerciseLabel: '练习',
    targetLabel: '目标词汇',
    inputPlaceholder: '在此输入您的改写答案...',
    checkButton: '评估改写',
    evaluating: 'AI 评分中...',
    meaningPreserved: '句意保留',
    targetUsed: '正确使用目标词',
    whatYouDidWell: '亮点表现',
    issuesToImprove: '改进建议',
    improvedVersion: '更佳润色表达',
    referenceAnswer: '参考范例',
    close: '关闭',
    syncingVocab: '正在同步更新词汇与练习释义...',
};

export function getI18nText(key: string, fallback?: string): string {
  const dict = CHINESE_STRINGS;
  return dict[key] || fallback || key;
}

/**
 * Returns localized meaning for a vocabulary item from Chinese vocabulary and reading translation caches
 */
export function getLocalizedVocabMeaning(
  vocab: VocabularyItem,
  translation?: ReadingTranslation
): string {
  // 1. Direct translation stored on vocab item itself
  if (vocab.translations?.['zh-CN']?.meaning) {
    return vocab.translations['zh-CN'].meaning;
  }

  // 2. From reading translation cache
  if (translation?.vocabularyTranslations) {
    const fromId = translation.vocabularyTranslations[vocab.id]?.meaning;
    if (fromId) return fromId;
    const fromTerm = translation.vocabularyTranslations[vocab.term.toLowerCase()]?.meaning;
    if (fromTerm) return fromTerm;
  }

  return vocab.meaningZh || '暂无释义';

}

/**
 * Returns localized example translation if available
 */
export function getLocalizedExampleTranslation(
  vocab: VocabularyItem,
  translation?: ReadingTranslation
): string | undefined {
  // 1. Direct translation stored on vocab item itself
  if (vocab.translations?.['zh-CN']?.exampleTranslation) {
    return vocab.translations['zh-CN'].exampleTranslation;
  }

  // 2. From reading translation cache
  if (translation?.vocabularyTranslations) {
    return (
      translation.vocabularyTranslations[vocab.id]?.exampleTranslation ||
      translation.vocabularyTranslations[vocab.term.toLowerCase()]?.exampleTranslation
    );
  }
  return undefined;
}

/**
 * Returns localized original sentence meaning for rewrite exercises
 */
export function getLocalizedExerciseMeaning(
  exercise: RewritePracticeItem,
  index: number,
  translation?: ReadingTranslation
): string | undefined {
  if (translation?.exerciseTranslations) {
    return (
      translation.exerciseTranslations[exercise.id]?.originalSentenceMeaning ||
      translation.exerciseTranslations[String(index)]?.originalSentenceMeaning
    );
  }
  return undefined;
}
