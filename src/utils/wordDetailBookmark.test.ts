import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleWordDetailBookmark} from './wordDetailBookmark';
import {registerModalBack} from './modalHistory';
import type {VocabularyItem} from '../types';

test('detail removal and undo preserve the full saved record and review schedule',async()=>{
 const saved={type:'word',phonetic:'',partOfSpeech:'adjective',meaningZh:'真实的',definitionEn:'Real.',example:'A genuine smile.',collocations:[],createdAt:0,updatedAt:0,id:'saved',term:'genuine',currentInterval:21,lastReviewedAt:100,nextReviewDate:900,reviewCount:8,status:'Mastered',addedFromReadingIds:['old','current'],translations:{'zh-CN':{meaning:'真实的'}}} as VocabularyItem;
 const article={...saved,id:'generated',currentInterval:0,reviewCount:0} as unknown as VocabularyItem;
 const removed=new Map<string,VocabularyItem>();let writes:VocabularyItem[]=[];let deletes:string[]=[];
 const store={save:async(v:VocabularyItem)=>{writes.push(v)},remove:async(id:string)=>{deletes.push(id)}};
 const empty=await toggleWordDetailBookmark(article,[saved],'current',removed,store);
 assert.deepEqual(empty,[]);assert.deepEqual(deletes,['saved']);
 const restored=await toggleWordDetailBookmark(article,empty,'current',removed,store);
 assert.deepEqual(restored,[saved]);assert.deepEqual(writes,[saved]);assert.equal(removed.size,0);
});
test('failed storage never publishes removal or consumes an undo snapshot',async()=>{
 const saved={id:'saved',term:'genuine'} as unknown as VocabularyItem;const removed=new Map<string,VocabularyItem>();
 const store={save:async()=>{throw new Error('save failed')},remove:async()=>{throw new Error('remove failed')}};
 await assert.rejects(toggleWordDetailBookmark(saved,[saved],undefined,removed,store),/remove failed/);assert.equal(removed.size,0);
 removed.set('genuine',saved);await assert.rejects(toggleWordDetailBookmark(saved,[],undefined,removed,store),/save failed/);assert.deepEqual(removed.get('genuine'),saved);
});
test('Back closes the modal once; ordinary close only removes its own history entry',()=>{
 let listener:()=>void;let closes=0;let backs=0;const entries:any[]=[{route:'reading'}];
 const history={get state(){return entries.at(-1)},pushState(s:any){entries.push(s)},back(){backs++;entries.pop();listener?.()}};
 const browser={history,addEventListener:(_e:string,fn:any)=>{listener=fn},removeEventListener:()=>{listener=undefined}} as unknown as Pick<Window,'history'|'addEventListener'|'removeEventListener'>;
 const cleanup=registerModalBack(()=>{closes++},browser);assert.equal(history.state.route,'reading');history.back();assert.equal(closes,1);cleanup();assert.equal(backs,1);
 const closeNormally=registerModalBack(()=>{closes++},browser);closeNormally();assert.equal(backs,2);assert.equal(closes,1);assert.deepEqual(history.state,{route:'reading'});
 const leave=registerModalBack(()=>{closes++},browser);history.pushState({route:'different'});leave();assert.equal(backs,2);assert.equal(history.state.route,'different');
});
test('adding an expression saved under another article attaches it without deleting its review history',async()=>{
 const saved={id:'other',term:'genuine',currentInterval:21,addedFromReadingIds:['other-reading']} as VocabularyItem;
 let stored:VocabularyItem;const store={save:async(v:VocabularyItem)=>{stored=v},remove:async()=>{throw new Error('must not remove')}};
 const result=await toggleWordDetailBookmark({...saved,id:'current-generated'},[saved],'current',new Map(),store,false);
 assert.equal(result.length,1);assert.equal(stored.id,'other');assert.equal(stored.currentInterval,21);assert.deepEqual(stored.addedFromReadingIds,['other-reading','current']);
});
