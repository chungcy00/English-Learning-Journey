import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {VocabularyItem} from '../types';
import {vocabularyTask,vocabularyLevel,createHistoryReviewRequest,historyReviewWords} from './historyVocabulary';
import {HistoryVocabularyTasks} from '../components/HistoryVocabularyTasks';
import {ReadingLevelPieChart} from '../components/ReadingLevelPieChart';
const words=[{id:'a',term:'considerate',cefrLevel:'A2',status:'Mastered',createdAt:2,nextReviewDate:50},{id:'b',term:'genuine',cefrLevel:'A2',status:'Learning',createdAt:3,nextReviewDate:200},{id:'c',term:'subtle',cefrLevel:'B2',status:'New',createdAt:1,nextReviewDate:100},{id:'d',term:'a saved phrase',status:'Mastered',createdAt:4,nextReviewDate:300}] as VocabularyItem[];
test('task totals, mastery and due counts use saved word levels and real timestamps',()=>{
 const a=vocabularyTask(words,'A2',100);assert.equal(a.total,2);assert.equal(a.due,1);assert.equal(a.mastered,1);assert.equal(a.percentage,50);assert.deepEqual(a.recent.map(v=>v.id),['b','a']);
 assert.equal(vocabularyTask(words,null,100).due,2);assert.equal(vocabularyTask(words,'C1',100).percentage,0);
 assert.equal(vocabularyLevel({}),'未知');assert.equal(vocabularyTask(words,'未知',100).total,1);
 assert.equal(vocabularyLevel({cefrLevel:'invalid' as any}),'未知');
});
test('review requests carry exact due IDs or an explicit free scope, never infer word CEFR from passage',()=>{
 const due=createHistoryReviewRequest(words,'A2',100)!;assert.deepEqual(due,{source:'history',level:'A2',mode:'due',ids:['a']});
 const free=createHistoryReviewRequest(words,'未知',100)!;assert.equal(free.mode,'free');assert.deepEqual(free.ids,['d']);
 assert.deepEqual(createHistoryReviewRequest(words,null,100)?.ids,['a','c']);assert.equal(createHistoryReviewRequest(words,'C1',100),null);
 assert.deepEqual(historyReviewWords(words.filter(v=>v.id!=='a'),due),[]);
 assert.deepEqual(historyReviewWords(words.map(v=>v.id==='a'?{...v,nextReviewDate:500}:v),due).map(v=>v.id),['a']);
 assert.deepEqual(historyReviewWords(words.map(v=>v.id==='a'?{...v,cefrLevel:'B2'}:v),due),[]);
});
test('vocabulary chart counts persisted vocabulary instead of unsaved passage selections; unknown has a normal selectable card',()=>{
 const html=renderToStaticMarkup(React.createElement(ReadingLevelPieChart,{readings:[{cefrLevel:'C1',selectedVocabulary:[{cefrLevel:'C2'}]}],vocabulary:words,dimension:'vocabulary',selectedLevel:'未知'}));
 assert.match(html,/本机已收录的 4 个可复习词条/);assert.match(html,/>未标注<\/span><strong>1 词<\/strong><small>25%/);
 assert.match(html,/筛选 未标注：1 词，25%/);assert.match(html,/未标注 未标注：1 词，25%/);assert.match(html,/C2 精通：0 词，0%/);
});
test('default tasks omit zero levels and word previews; detailed task shows only its own recent words',()=>{
 const props={vocabulary:words,now:100,onSelectLevel:()=>{},onReview:()=>{},onOpenWordbook:()=>{}};
 const all=renderToStaticMarkup(React.createElement(HistoryVocabularyTasks,{...props,selectedLevel:null}));
 assert.match(all,/全部词汇综合复习/);assert.match(all,/分级专项复习/);assert.doesNotMatch(all,/considerate|genuine|subtle|查看C1复习看板/);
 const detail=renderToStaticMarkup(React.createElement(HistoryVocabularyTasks,{...props,selectedLevel:'A2'}));
 assert.match(detail,/considerate/);assert.match(detail,/genuine/);assert.doesNotMatch(detail,/subtle|分级专项复习/);assert.match(detail,/1\/2 词（50%）/);
 assert.match(detail,/aria-valuenow="50"/);assert.match(detail,/查看全部A2词汇/);
});

test('history scope is wired to the existing review and wordbook without changing the current-passage entry',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
 const review=readFileSync(new URL('../views/ReviewView.tsx',import.meta.url),'utf8');
 assert.match(app,/vocabulary=\{vocabularies\}/);
 assert.match(app,/allVocabularies=\{scopedHistoryReview\}/);
 assert.match(app,/allVocabularies=\{reviewVocabulary\}/);
 assert.match(app,/vocabularyList=\{wordbookVocabulary\}/);
 assert.match(app,/practiceOnly=\{historyReview.mode === 'free'\}/);
 assert.match(review,/if \(!practiceOnly\) await onRate\(currentVocab.id, rating\)/);
 assert.match(review,/practiceOnly \? '本轮练习' : reviewDelayLabel/);
});

test('starting again rebuilds due/free scope from the latest scheduling and collection',()=>{
 const started=createHistoryReviewRequest(words,'A2',100)!;
 const afterRating=words.map(v=>v.id==='a'?{...v,nextReviewDate:500}:v);
 assert.equal(createHistoryReviewRequest(afterRating,'A2',100)?.mode,'free');
 assert.deepEqual(createHistoryReviewRequest(afterRating,'A2',100)?.ids,['a','b']);
 assert.deepEqual(historyReviewWords(afterRating,started).map(v=>v.id),['a']);
 const newlyDue=[...afterRating,{...words[0],id:'new',nextReviewDate:90}];
 assert.deepEqual(createHistoryReviewRequest(newlyDue,'A2',100)?.ids,['new']);
 assert.equal(createHistoryReviewRequest(words.filter(v=>v.cefrLevel!=='A2'),'A2',100),null);
});
