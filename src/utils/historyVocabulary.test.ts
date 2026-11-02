import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {VocabularyItem} from '../types';
import {vocabularyTask,vocabularyLevel,createHistoryReviewRequest,historyReviewWords} from './historyVocabulary';
import {HistoryVocabularyTasks} from '../components/HistoryVocabularyTasks';
import {ReadingLevelPieChart} from '../components/ReadingLevelPieChart';
const words=[{id:'a',term:'considerate',cefrLevel:'A2',status:'Mastered',createdAt:2,nextReviewDate:50},{id:'b',term:'genuine',cefrLevel:'A2',status:'Learning',createdAt:3,nextReviewDate:200},{id:'c',term:'subtle',cefrLevel:'B2',status:'New',createdAt:1,nextReviewDate:100},{id:'d',term:'a saved phrase',status:'Mastered',createdAt:4,nextReviewDate:300}] as VocabularyItem[];
test('task counts use persisted learning status within the selected word level',()=>{
 const a=vocabularyTask(words,'A2');assert.equal(a.total,2);assert.equal(a.mastered,1);assert.equal(a.percentage,50);assert.deepEqual(a.recent.map(v=>v.id),['b','a']);
 assert.deepEqual(a.statusCounts,{New:0,Learning:1,Difficult:0,Mastered:1});
 assert.deepEqual(vocabularyTask(words,null).statusCounts,{New:1,Learning:1,Difficult:0,Mastered:2});
 assert.equal(vocabularyTask(words,'C1').percentage,0);
 assert.equal(vocabularyLevel({}),'未知');assert.equal(vocabularyTask(words,'未知').total,1);
 assert.equal(vocabularyLevel({cefrLevel:'invalid' as any}),'未知');
});
test('status review snapshots exact IDs so a new rating does not shrink and skip the active queue',()=>{
 const selected=createHistoryReviewRequest(words,'A2','status','Learning')!;assert.deepEqual(selected,{source:'history',level:'A2',mode:'status',status:'Learning',ids:['b']});
 const free=createHistoryReviewRequest(words,'未知')!;assert.equal(free.mode,'free');assert.deepEqual(free.ids,['d']);
 assert.deepEqual(createHistoryReviewRequest(words,null)?.ids,['a','b','c','d']);assert.equal(createHistoryReviewRequest(words,'C1'),null);
 assert.equal(createHistoryReviewRequest(words,'A2','status'),null);
 assert.deepEqual(historyReviewWords(words.filter(v=>v.id!=='b'),selected),[]);
 assert.deepEqual(historyReviewWords(words.map(v=>v.id==='b'?{...v,status:'Mastered',nextReviewDate:500}:v),selected).map(v=>v.id),['b']);
 assert.deepEqual(historyReviewWords(words.map(v=>v.id==='b'?{...v,cefrLevel:'B2'}:v),selected),[]);
});
test('vocabulary chart counts persisted vocabulary instead of unsaved passage selections; unknown has a normal selectable card',()=>{
 const html=renderToStaticMarkup(React.createElement(ReadingLevelPieChart,{readings:[{cefrLevel:'C1',selectedVocabulary:[{cefrLevel:'C2'}]}],vocabulary:words,dimension:'vocabulary',selectedLevel:'未知'}));
 assert.match(html,/本机已收录的 4 个可复习词条/);assert.match(html,/>未标注<\/span><strong>1 词<\/strong><small>25%/);
 assert.match(html,/筛选 未标注：1 词，25%/);assert.match(html,/未标注 未标注：1 词，25%/);assert.match(html,/C2 精通：0 词，0%/);
});
test('default tasks omit zero levels and word previews; detailed task shows only its own recent words',()=>{
 const props={vocabulary:words,onSelectLevel:()=>{},onReview:()=>{},onOpenWordbook:()=>{}};
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
 assert.match(app,/vocabulary=\{historyVocabulary\}/);
 assert.match(app,/allVocabularies=\{scopedHistoryReview\}/);
 assert.match(app,/allVocabularies=\{reviewVocabulary\}/);
 assert.match(app,/vocabularyList=\{wordbookVocabulary\}/);
 assert.match(app,/practiceOnly=\{historyReview.mode === 'free'\}/);
 assert.match(review,/if \(!practiceOnly\) await onRate\(currentVocab.id, rating\)/);
 assert.match(review,/practiceOnly \? '本轮练习' : reviewDelayLabel/);
});

test('refresh rebuilds the chosen status and never substitutes other categories or dates',()=>{
 const started=createHistoryReviewRequest(words,'A2','status','Learning')!;
 const afterRating=words.map(v=>v.id==='b'?{...v,status:'Mastered' as const,nextReviewDate:500}:v);
 assert.deepEqual(createHistoryReviewRequest(afterRating,'A2')?.ids,['a','b']);
 assert.deepEqual(historyReviewWords(afterRating,started).map(v=>v.id),['b']);
 assert.equal(createHistoryReviewRequest(afterRating,'A2','status','Learning'),null);
 const newlyLearning=[...afterRating,{...words[0],id:'new',status:'Learning' as const,nextReviewDate:999999}];
 assert.deepEqual(createHistoryReviewRequest(newlyLearning,'A2','status','Learning')?.ids,['new']);
 assert.deepEqual(createHistoryReviewRequest(newlyLearning,'A2','free')?.ids,['a','b','new']);
 assert.equal(createHistoryReviewRequest(words.filter(v=>v.cefrLevel!=='A2'),'A2'),null);
});

test('nine collected words remain nine for all review; selectors show actual 4/3/1/1 learning categories',()=>{
 const statuses=['New','New','New','New','Learning','Learning','Learning','Difficult','Mastered'] as const;
 const nine=statuses.map((status,index)=>({...words[0],id:`b1-${index}`,cefrLevel:'B1',status,nextReviewDate:index===0?50:500})) as VocabularyItem[];
 const counts=vocabularyTask(nine,'B1');assert.equal(counts.total,9);assert.deepEqual(counts.statusCounts,{New:4,Learning:3,Difficult:1,Mastered:1});
 const all=createHistoryReviewRequest(nine,'B1')!;
 assert.equal(all.mode,'free');assert.equal(historyReviewWords(nine,all).length,9);
 assert.equal(historyReviewWords(nine,createHistoryReviewRequest(nine,'B1','status','Learning')!).length,3);
 const html=renderToStaticMarkup(React.createElement(HistoryVocabularyTasks,{vocabulary:nine,selectedLevel:'B1',onSelectLevel(){},onReview(){},onOpenWordbook(){}}));
 assert.match(html,/复习全部B1词汇（9词）/);assert.match(html,/B1分类复习：未学习（4词）/);
 for (const label of ['未学习（4词）','学习中（3词）','困难（1词）','已掌握（1词）']) assert.ok(html.includes(label));
 assert.doesNotMatch(html,/到期|待复习/);
 assert.equal(createHistoryReviewRequest(nine.filter(word=>word.status!=='New'),'B1','status','New'),null);
});
