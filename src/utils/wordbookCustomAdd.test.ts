import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WordbookCustomAdd,customWordbookItem} from '../components/WordbookCustomAdd';
import {explainVocabularyTerm} from '../services/api';
import type {ReadingRecord} from '../types';
const reading={id:'passage',cefrLevel:'A2',content:'A sunny day.',selectedVocabulary:[]} as unknown as ReadingRecord;
test('custom addition starts collapsed and remains separate from the passage search',()=>{
 const html=renderToStaticMarkup(React.createElement(WordbookCustomAdd,{reading,vocabulary:[],onSave:async()=>{}}));
 assert.match(html,/添加单词／词组/);assert.match(html,/aria-expanded="false"/);
 assert.doesNotMatch(html,/<input|查询释义|加入生词本/);
});
test('custom dictionary query omits passage and requested level, and propagates failed lookups',async()=>{
 const realFetch=globalThis.fetch;let fail=false;
 globalThis.fetch=(async(_url,init)=>{
  const body=JSON.parse(String(init?.body));assert.equal(body.term,'serendipity');assert.equal(body.requireInReading,false);assert.equal(body.cefrLevel,undefined);assert.equal(body.contextReading,undefined);
  return new Response(JSON.stringify(fail?{error:'未能确认这个英文词条'}:{term:'serendipity',cefrLevel:'C1',meaningZh:'意外的幸运发现'}),{status:fail?422:200});
 }) as typeof fetch;
 try{
  assert.equal((await explainVocabularyTerm('serendipity',undefined,true,{requireInReading:false})).cefrLevel,'C1');
  fail=true;await assert.rejects(explainVocabularyTerm('serendipity',undefined,true,{requireInReading:false}),/未能确认/);
 }finally{globalThis.fetch=realFetch;}
});
test('custom words preserve independently assessed level and link to current passage for review/deletion',()=>{
 const item=customWordbookItem({term:'serendipity',cefrLevel:'C1',type:'word',meaningZh:'意外的幸运发现',definitionEn:'A fortunate discovery.',example:'It was serendipity.'},reading,100,'new-id');
 assert.equal(item.cefrLevel,'C1');assert.equal(item.sourceCefrLevel,undefined);assert.equal(item.sourceReadingId,undefined);assert.equal(item.origin,'manual');
 assert.equal(item.status,'New');assert.equal(item.savedManually,true);assert.ok(item.nextReviewDate>0);assert.equal(item.reviewCount,0);
});
