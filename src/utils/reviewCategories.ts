import {VOCABULARY_CATEGORIES,type VocabularyCategory,type VocabularyItem} from '../types';
export type ReviewCategory = VocabularyCategory | 'all';
export function reviewCategory(word:VocabularyItem):VocabularyCategory {
 const category=word.category || word.details?.category;
 if(category && VOCABULARY_CATEGORIES.includes(category))return category;
 if(word.type==='idiom')return 'idiom';
 if(/phrasal[ -]verb|短语动词/i.test(word.partOfSpeech||''))return 'phrasal-verb';
 return word.type==='word'?'word':'phrase';
}
export function availableReviewCategories(words:VocabularyItem[]) {
 const present=new Set(words.map(reviewCategory));
 return VOCABULARY_CATEGORIES.filter(category=>present.has(category));
}
export function reviewWordsForCategory(words:VocabularyItem[],category:ReviewCategory) {
 return category==='all'?words:words.filter(word=>reviewCategory(word)===category);
}
