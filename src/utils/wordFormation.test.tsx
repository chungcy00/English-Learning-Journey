import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DerivativeList, RootAnalysis } from '../components/WordFormation';
import { inflectionLabel, legacyDetails, basicVocabulary, mergeGeneratedDetails } from './vocabularyDetails';
import type { LearningEntry } from '../types';
const entry: LearningEntry={id:'root',text:'help',meaningZh:'帮助',morphology:{root:'help',meaningZh:'帮助',parts:[{kind:'root',text:'help',meaningZh:'帮助'},{kind:'suffix',text:'ful',meaningZh:'具有……性质的'}],explanation:'构成有帮助的含义。',mnemonic:'记住一个乐于帮助的人。',related:[{word:'helpless',partOfSpeech:'adjective',meaningZh:'无助的'}]}};
test('root rendering separates true formation from memory and exposes labels, color hooks and same-root speech',()=>{
 const html=renderToStaticMarkup(<RootAnalysis entry={entry} term="helpful" pronounce={()=>{}}/>);
 for(const text of ['真实构词分析','辅助记忆联想','词根','后缀','同根词','lexicon-word-part--root','朗读：helpless'])assert.ok(html.includes(text));
 assert.ok(renderToStaticMarkup(<RootAnalysis entry={{id:'old',text:'旧资料',meaningZh:'原有内容'}} term="helpful" pronounce={()=>{}}/>).includes('原有内容'));
});
test('derivatives are grouped by lexical base and render separate word, POS, meaning and pronunciation',()=>{
 const family={base:'help',relation:'派生关系'};
 const html=renderToStaticMarkup(<DerivativeList entries={[{id:'1',text:'helpful',partOfSpeech:'adjective',meaningZh:'有帮助的',family},{id:'2',text:'helpless',partOfSpeech:'adjective',meaningZh:'无助的',family}]} pronounce={()=>{}}/>);
 assert.equal(html.split('词族 ·').length-1,1);for(const text of ['有帮助的','无助的','adjective','朗读：helpful','派生关系'])assert.ok(html.includes(text));
});
test('Chinese labels translate legacy API aliases without changing saved word forms or custom labels',()=>{
 for(const [input,expected] of Object.entries({plural:'复数','third-person singular':'三单',past:'过去式',participle:'过去分词','present_participle':'现在分词',comparative:'比较级',superlative:'最高级','自定义':'自定义'}))assert.equal(inflectionLabel(input),expected);
});
test('section regeneration retains structured manual edits and all other sections',()=>{
 const current=legacyDetails(basicVocabulary('helpful'));current.sections.roots=[entry];current.provenance.roots={source:'user',updatedAt:1};
 const incoming=structuredClone(current);incoming.sections.roots=[];
 assert.deepEqual(mergeGeneratedDetails(current,incoming).sections.roots,[entry]);
 assert.deepEqual(mergeGeneratedDetails(current,incoming,'derivatives',true).sections.roots,[entry]);
 assert.deepEqual(mergeGeneratedDetails(current,incoming,'roots',true).sections.roots,[]);
});
