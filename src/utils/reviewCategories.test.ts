import {test} from 'node:test';import assert from 'node:assert/strict';
import {reviewCategory,availableReviewCategories,reviewWordsForCategory} from './reviewCategories';import type {VocabularyItem} from '../types';
const words=[{id:'a',type:'word'},{id:'b',type:'phrase'},{id:'c',type:'idiom'},{id:'d',type:'phrase',category:'collocation'},{id:'e',type:'phrase',partOfSpeech:'phrasal verb'}] as VocabularyItem[];
test('categories follow saved metadata, legacy types and cached classification without inventing word families',()=>{
 assert.deepEqual(words.map(reviewCategory),['word','phrase','idiom','collocation','phrasal-verb']);assert.equal(reviewCategory({...words[1],details:{category:'idiom'} as any}),'idiom');assert.deepEqual(availableReviewCategories([words[0],words[2]]),['word','idiom']);assert.deepEqual(availableReviewCategories([]),[]);
});
test('filtering supplies only the selected category and preserves canonical objects and progress',()=>{
 assert.equal(reviewWordsForCategory(words,'all'),words);assert.deepEqual(reviewWordsForCategory(words,'idiom'),[words[2]]);assert.equal(reviewWordsForCategory(words,'word')[0],words[0]);assert.equal(reviewWordsForCategory(words,'collocation').length,1);
});
