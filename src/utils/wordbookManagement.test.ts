import assert from 'node:assert/strict';
import {test} from 'node:test';
import {wordbookSuggestions,wordbookResults,toggleVisibleSelection,wordbookMeta} from './wordbookManagement';
import type {ReadingRecord,VocabularyItem} from '../types';
const items=[{id:'a',term:'genuine',status:'Learning',partOfSpeech:'adjective',type:'word'}, {id:'b',term:'considerate',status:'New',partOfSpeech:'形容词',type:'word'}] as VocabularyItem[];
const reading={id:'r',content:'A genuine volunteer helped a considerate person at a bookshop.',selectedVocabulary:items} as ReadingRecord;
test('unified search suggests actual passage terms and excludes saved terms case-insensitively',()=>{
 assert.equal(wordbookSuggestions(reading,[],items,'gen').length,0);
 assert.equal(wordbookSuggestions(reading,[],items,'vol')[0].term,'volunteer');
 assert.equal(wordbookSuggestions(reading,[],items,'moon').length,0);
 assert.equal(wordbookSuggestions(null,[],items,'vol').length,0);
 assert.equal(wordbookSuggestions(reading,[],[{...items[0],term:'GENUINE'}],'genuine').length,0);
});
test('a saved search hit remains visible under a conflicting status filter without changing source state',()=>{
 const result=wordbookResults(items,'genuine','New',false);
 assert.equal(result.fallback,true);assert.deepEqual(result.visible,[items[0]]);
 assert.equal(items[0].status,'Learning');
 assert.equal(wordbookResults(items,'','Difficult',false).visible.length,0);
});
test('search shows all saved matches even when the active filter also has a match',()=>{
 const matching=[{...items[0],term:'genuine care'},{...items[1],term:'genuine concern'}];
 const result=wordbookResults(matching,'genuine','New',false);
 assert.equal(result.fallback,true);
 assert.deepEqual(result.visible.map(v=>v.id),['a','b']);
 assert.equal(wordbookResults(matching,'','New',false).visible.length,1);
});
test('stale selected vocabulary and catalogue entries are never suggested outside the actual passage',()=>{
 const stale={...reading,selectedVocabulary:[...items,{...items[0],term:'moonlight'}]};
 assert.deepEqual(wordbookSuggestions(stale,[{term:'moonlight',type:'word',cefrLevel:'B1',contextQuote:'Old content.'}],[],'moon'),[]);
});
test('alphabetical order can reverse without mutating the saved collection',()=>{
 assert.deepEqual(wordbookResults(items,'','All',false).visible.map(v=>v.id),['b','a']);
 assert.deepEqual(wordbookResults(items,'','All',true).visible.map(v=>v.id),['a','b']);
 assert.equal(items[0].id,'a');
});
test('English abbreviations and phrase categories use Chinese display metadata without changing stored data',()=>{
 for(const [partOfSpeech,expected] of [['adj','形容词'],['ADV.','副词'],['phrasal verb','短语动词'],['det.','限定词'],['interjection','感叹词']]){
  const item={partOfSpeech,type:'word' as const};
  assert.equal(wordbookMeta(item),`${expected} · 单词`);
  assert.equal(item.partOfSpeech,partOfSpeech);
 }
});
test('select all toggles only the visible IDs and metadata is Chinese without invented parts of speech',()=>{
 assert.deepEqual(toggleVisibleSelection([],['a']),['a']);
 assert.deepEqual(toggleVisibleSelection(['a'],['a']),[]);
 assert.deepEqual(toggleVisibleSelection(['other'],['a']),['other','a']);
 assert.equal(wordbookMeta(items[0]),'形容词 · 单词');
 assert.equal(wordbookMeta({partOfSpeech:'',type:'word'}),'单词');
});
