import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sanitizeSentenceTranslations,mergeReadingTranslations} from './translationResults';
import {hasCompleteSentenceTranslations} from './readingSegments';
import type {ReadingTranslation} from '../types';
const base={title:'中文标题',translatedContent:'你好，欢迎！谢谢。',language:'zh-CN',languageName:'简体中文',updatedAt:1} as ReadingTranslation;
test('provider mappings accept whitespace differences and exact spans within one speaker, never cross speakers or fuzzy source',()=>{
 const sources=['Hello.','Welcome!','Thank you.'];
 const result=sanitizeSentenceTranslations(sources,['Hello. Welcome!','Thank you.'],[
  {source:' Hello.  Welcome! ',translation:'你好，欢迎！'},
  {source:'Thank you.',translation:'谢谢。'},
  {source:'Welcome! Thank you.',translation:'错误跨角色'},
  {source:'Welcome.',translation:'错误标点'},
 ]);
 assert.deepEqual(result,[{source:'Hello. Welcome!',translation:'你好，欢迎！'},{source:'Thank you.',translation:'谢谢。'}]);
 assert.equal(hasCompleteSentenceTranslations(sources.slice(0,2),{...base,sentenceTranslations:result}),true);
});
test('a partial retry keeps the actual full translation and prior valid sentence mappings',()=>{
 const old={...base,sentenceTranslations:[{source:'Hello.',translation:'你好。'}]};
 const result=mergeReadingTranslations(old,{...base,translatedContent:'',sentenceTranslations:[{source:'Welcome!',translation:'欢迎！'}]},[['Hello.','Welcome!']]);
 assert.equal(result.translatedContent,old.translatedContent);
 assert.equal(hasCompleteSentenceTranslations(['Hello.','Welcome!'],result),true);
 const first=mergeReadingTranslations(undefined,{...base,sentenceTranslations:[{source:'Hello.',translation:'你好。'}]},[['Hello.','Welcome!']]);
 assert.equal(first.translatedContent,base.translatedContent);
 assert.equal(first.sentenceTranslations?.length,1);
 assert.equal(hasCompleteSentenceTranslations(['Hello.','Welcome!'],first),false);
});
test('partial or conflicting retries do not destroy an already complete source-span cache',()=>{
 const old={...base,sentenceTranslations:[{source:'Hello. Welcome!',translation:'你好，欢迎！'}]};
 const result=mergeReadingTranslations(old,{...base,sentenceTranslations:[{source:'Hello.',translation:'你好。'}]},[['Hello.','Welcome!']]);
 assert.equal(hasCompleteSentenceTranslations(['Hello.','Welcome!'],result),true);
 assert.deepEqual(result.sentenceTranslations,old.sentenceTranslations);
 const conflict=mergeReadingTranslations(undefined,{...base,sentenceTranslations:[{source:'Hello.',translation:'甲'},{source:'Hello.',translation:'乙'}]},[['Hello.']]);
 assert.equal(conflict.sentenceTranslations?.length,0);
});
test('complete sentence-only results assemble readable full text without guessing sentence or speaker alignment',()=>{
 const incoming={...base,title:'',translatedContent:'',sentenceTranslations:[{source:'Hello.',translation:'你好。'},{source:'Welcome!',translation:'欢迎！'}]};
 const prose=mergeReadingTranslations(undefined,incoming,[['Hello.'],['Welcome!']]);
 assert.equal(prose.translatedContent,'你好。\n\n欢迎！');
 const dialogue=mergeReadingTranslations(undefined,incoming,[['Hello.'],['Welcome!']],['Sarah','Mark']);
 assert.equal(dialogue.translatedContent,'Sarah: 你好。\n\nMark: 欢迎！');
 const partial=mergeReadingTranslations(undefined,{...incoming,sentenceTranslations:incoming.sentenceTranslations.slice(0,1)},[['Hello.'],['Welcome!']],['Sarah','Mark']);
 assert.equal(partial.translatedContent,'');
});
