import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {VocabularyItem} from '../types';
import {vocabularyTask,vocabularyLevel,createHistoryReviewRequest,historyReviewWords} from './historyVocabulary';
import {HistoryVocabularyTasks} from '../components/HistoryVocabularyTasks';
import {ReadingLevelPieChart} from '../components/ReadingLevelPieChart';
const words=[{id:'a',term:'considerate',cefrLevel:'A2',status:'Mastered',createdAt:2,nextReviewDate:50},{id:'b',term:'genuine',cefrLevel:'A2',status:'Learning',createdAt:3,nextReviewDate:200},{id:'c',term:'subtle',cefrLevel:'B2',status:'New',createdAt:1,nextReviewDate:100},{id:'d',term:'a saved phrase',status:'Mastered',createdAt:4,nextReviewDate:300}] as VocabularyItem[];
test('level counts include all saved words and omit mastery statistics',()=>{
 const a=vocabularyTask(words,'A2');assert.equal(a.total,2);assert.deepEqual(a.recent.map(v=>v.id),['b','a']);
 assert.equal('mastered' in a,false);assert.equal('statusCounts' in a,false);assert.equal(vocabularyTask(words,'C1').total,0);
 assert.equal(vocabularyLevel({}),'未知');assert.equal(vocabularyTask(words,'未知').total,1);assert.equal(vocabularyLevel({cefrLevel:'invalid' as any}),'未知');
});

test('level browsing snapshots all IDs regardless of old statuses or due dates',()=>{
 const selected=createHistoryReviewRequest(words,'A2')!;assert.deepEqual(selected,{source:'history',level:'A2',ids:['a','b']});
 assert.deepEqual(createHistoryReviewRequest(words,'未知')?.ids,['d']);assert.deepEqual(createHistoryReviewRequest(words,null)?.ids,['a','b','c','d']);assert.equal(createHistoryReviewRequest(words,'C1'),null);
 assert.deepEqual(historyReviewWords(words.filter(v=>v.id!=='b'),selected).map(v=>v.id),['a']);
 assert.deepEqual(historyReviewWords(words.map(v=>v.id==='b'?{...v,status:'Mastered',nextReviewDate:500}:v),selected).map(v=>v.id),['a','b']);
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
 assert.match(detail,/considerate/);assert.match(detail,/genuine/);assert.doesNotMatch(detail,/subtle|分级专项复习/);assert.doesNotMatch(detail,/掌握|学习状态|history-status/);
 assert.doesNotMatch(detail,/aria-valuenow/);assert.match(detail,/查看全部A2词汇/);
});

test('history scope is wired to the existing review and wordbook without changing the current-passage entry',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
 const review=readFileSync(new URL('../views/ReviewView.tsx',import.meta.url),'utf8');
 assert.match(app,/vocabulary=\{historyVocabulary\}/);
 assert.match(app,/allVocabularies=\{scopedHistoryReview\}/);
 assert.match(app,/allVocabularies=\{vocabularies\}/);
 assert.match(app,/vocabularyList=\{wordbookVocabulary\}/);
 assert.doesNotMatch(review,/onRate|handleRating|reviewDelayLabel/);
 assert.match(review,/PracticeVocabularyCard/);
});

test('level refresh includes newly saved words without a learning-status dependency',()=>{
 const started=createHistoryReviewRequest(words,'A2')!;const updated=[...words,{...words[0],id:'new',status:'Difficult' as const,nextReviewDate:999999}];
 assert.deepEqual(createHistoryReviewRequest(updated,'A2')?.ids,['a','b','new']);assert.deepEqual(historyReviewWords(updated,started).map(v=>v.id),['a','b']);
 assert.equal(createHistoryReviewRequest(words.filter(v=>v.cefrLevel!=='A2'),'A2'),null);
});

test('history retains all vocabulary and removes every status category and mastery indicator',()=>{
 const nine=Array.from({length:9},(_,i)=>({...words[i%words.length],id:`b1-${i}`,cefrLevel:'B1'})) as VocabularyItem[];
 const all=createHistoryReviewRequest(nine,'B1')!;assert.equal(historyReviewWords(nine,all).length,9);
 const html=renderToStaticMarkup(React.createElement(HistoryVocabularyTasks,{vocabulary:nine,selectedLevel:'B1',onSelectLevel(){},onReview(){},onOpenWordbook(){}}));
 assert.match(html,/复习全部B1词汇（9词）/);assert.doesNotMatch(html,/新词|未学习|学习中|困难|已掌握|掌握进度|progressbar|分类复习/);
});
