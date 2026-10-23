import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {rewriteExamples} from './rewriteFeedback';
import {rewriteNextAction} from './rewriteQuestions';
import {RewriteFeedback} from '../components/RewriteFeedback';
import {evaluateRewriteAnswer} from '../services/api';
import type {RewriteEvaluation} from '../types';
const result: RewriteEvaluation={rating:'Good',meaningPreserved:true,targetUsedCorrectly:true,whatYouDidWell:[],issues:[],improvedVersion:'She was genuine.',referenceAnswer:'She was genuine.'};
test('reference dedup compares formatting conservatively without discarding changed meaning',()=>{
 assert.equal(rewriteExamples({...result,referenceAnswer:'  “She was genuine.”  '}).length,1);
 assert.equal(rewriteExamples({...result,referenceAnswer:'She was not genuine.'}).length,2);
 assert.equal(rewriteExamples({...result,referenceAnswer:'He was genuine.'}).length,2);
 assert.equal(rewriteExamples({...result,improvedVersion:'Help US.',referenceAnswer:'Help us.'}).length,2);
 assert.equal(rewriteExamples({...result,improvedVersion:'',referenceAnswer:''}).length,0);
});
test('feedback hides empty modules, preserves original examples and highlights actual recommendations',()=>{
 const html=renderToStaticMarkup(React.createElement(RewriteFeedback,{evaluation:{...result,whatYouDidWell:[' '],issues:[{original:'genuine good',correction:'a genuine welcome',explanation:'Use a noun phrase.'}]}}));
 assert.doesNotMatch(html,/亮点表现/);assert.match(html,/推荐表达/);assert.match(html,/<mark>a genuine welcome<\/mark>/);
 assert.equal((html.match(/She was genuine\./g)||[]).length,1);
});
test('last question finds unfinished work and completes only when every evaluation is valid',()=>{
 assert.deepEqual(rewriteNextAction(0,[true,false,true]),{label:'下一题',index:1});
 assert.deepEqual(rewriteNextAction(2,[true,false,true]),{label:'继续未完成题目',index:1});
 assert.deepEqual(rewriteNextAction(2,[true,true,true]),{label:'完成练习',index:null});
});
test('API failures never return client-generated evaluations',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'Service unavailable'}),{status:503});
  await assert.rejects(evaluateRewriteAnswer({originalSentence:'A sentence.',target:'genuine',userAnswer:'A genuine sentence.',referenceAnswer:'A genuine sentence.',cefrLevel:'B1'}),/Service unavailable/);
  globalThis.fetch=async()=>{throw new Error('offline');};
  await assert.rejects(evaluateRewriteAnswer({originalSentence:'A sentence.',target:'genuine',userAnswer:'A genuine sentence.',referenceAnswer:'A genuine sentence.',cefrLevel:'B1'}),/网络连接失败/);
 }finally{globalThis.fetch=original;}
});
