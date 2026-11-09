import {test} from 'node:test';import assert from 'node:assert/strict';
import {sampleReviewIds,reconcileReviewIds,readRandomReview,writeRandomReview} from './randomReview';
test('sampling is unique, bounded, non-mutating and shuffles all mode',()=>{
 const pool=['a','b','c','d'];assert.deepEqual(sampleReviewIds(pool,2,()=>0),['b','c']);assert.deepEqual(pool,['a','b','c','d']);assert.equal(sampleReviewIds(pool,50).length,4);assert.equal(new Set(sampleReviewIds([...pool,'a'],null)).size,4);assert.deepEqual(sampleReviewIds([],20),[]);assert.equal(sampleReviewIds(pool,0).length,1);
});
test('refresh preserves the selected order, removes deleted items and fills vacancies without duplicates',()=>{
 assert.deepEqual(reconcileReviewIds(['c','a'],['a','b','c','d'],2),['c','a']);const ids=reconcileReviewIds(['deleted','a'],['a','b','c'],2);assert.equal(ids[0],'a');assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);assert.equal(reconcileReviewIds(['a'],['a','b'],null).length,2);
});
test('random sessions persist independently by scope without changing existing review progress',()=>{
 const storage=new Map<string,string>();const previous=globalThis.sessionStorage;Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)}});
 try{storage.set('mine_english_review_progress','untouched');writeRandomReview({count:10,ids:['b','a']});writeRandomReview({count:null,ids:['c']},'history');assert.deepEqual(readRandomReview(),{count:10,ids:['b','a']});assert.deepEqual(readRandomReview('history'),{count:null,ids:['c']});assert.equal(storage.get('mine_english_review_progress'),'untouched');storage.set('mine-random-review:all','{"count":-1,"ids":[]}');assert.equal(readRandomReview(),null);}finally{Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:previous});}
});
