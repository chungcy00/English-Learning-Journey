import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExampleSenseCards } from '../components/ExampleSenseCards';
import { DefinitionCards } from '../components/DefinitionCards';
import { PhraseList } from '../components/PhraseUsage';
import { DerivativeList, RootAnalysis } from '../components/WordFormation';
import { UsageList } from '../components/UsageAnalysis';
import { emptyUsage, usageEntry } from './structuredUsage';
import type { LearningEntry, StructuredUsage } from '../types';

const pronounce = () => {};
function includesFields(html: string, fields: string[]) {
  for (const field of fields) assert.ok(html.includes(field), `Missing learning field: ${field}`);
}

test('example cards expose the association, both meanings, POS, sentence, translation and note', () => {
 const entry: LearningEntry = {id:'e',text:'associated expression',meaningZh:'表达含义标记',senseMeaningZh:'本组词义标记',partOfSpeech:'verb',example:'Example sentence marker.',exampleTranslation:'例句译文标记',note:'例句备注标记'};
 const html = renderToStaticMarkup(<ExampleSenseCards entries={[entry]} senses={[]} pronounce={pronounce} busy={false} isSaved={()=>false} onToggle={()=>{}}/>);
 includesFields(html, ['associated expression','表达含义标记','本组词义标记','v.','Example sentence marker.','例句译文标记','例句备注标记']);
 const identical = renderToStaticMarkup(<ExampleSenseCards entries={[{...entry,text:entry.example!}]} senses={[]} pronounce={pronounce} busy={false} isSaved={()=>false} onToggle={()=>{}}/>);
 includesFields(identical, ['表达含义标记','本组词义标记','例句译文标记']);
});

test('saved derivative learning fields remain readable for an explicit family relationship', () => {
 const entry: LearningEntry = {id:'d',text:'helpfulness',meaningZh:'派生含义标记',partOfSpeech:'noun',note:'派生备注标记',example:'Derivative example marker.',exampleTranslation:'派生译文标记',family:{base:'helpful',parent:'helpful',relation:'构词关系标记',parts:[{kind:'suffix',text:'suffix-marker',meaningZh:'部件含义标记'}]}};
 const html = renderToStaticMarkup(<DerivativeList entries={[entry]} term="helpful" pronounce={pronounce}/>);
 assert.doesNotMatch(html, /词族基础词|直接派生自/);
 includesFields(html, ['helpfulness','派生含义标记','n.','派生备注标记','Derivative example marker.','派生译文标记','构词关系标记','suffix-marker','部件含义标记']);
});

test('root cards expose every learning field for a clear same-root relationship', () => {
 const html = renderToStaticMarkup(<RootAnalysis entry={{id:'r',text:'',meaningZh:'',morphology:{parts:[{kind:'prefix',text:'un',meaningZh:'前缀含义标记'},{kind:'root',text:'help',meaningZh:'词根含义标记'},{kind:'suffix',text:'ful',meaningZh:'后缀含义标记'}],explanation:'构词说明标记',mnemonic:'助记标记',related:[{word:'helpfully',partOfSpeech:'adverb',meaningZh:'同根词含义标记',relation:'同根词关系标记',parts:[{kind:'root',text:'help',meaningZh:'词根含义标记'},{kind:'suffix',text:'fully',meaningZh:'同根部件含义标记'}]}]}}} term="unhelpful" pronounce={pronounce}/>);
 includesFields(html, ['un','前缀含义标记','help','词根含义标记','ful','后缀含义标记','构词说明标记','助记标记','helpfully','adv.','同根词含义标记','同根词关系标记','fully','同根部件含义标记']);
});

test('phrases preserve standalone translations and notes and definitions expose their English text', () => {
 const entry: LearningEntry = {id:'p',text:'phrase marker',meaningZh:'词组含义标记',exampleTranslation:'独立译文标记',note:'词组备注标记'};
 includesFields(renderToStaticMarkup(<PhraseList entries={[entry]} pronounce={pronounce} busy={false} isSaved={()=>false} onToggle={()=>{}}/>), ['phrase marker','词组含义标记','独立译文标记','词组备注标记']);
 includesFields(renderToStaticMarkup(<DefinitionCards entries={[{id:'f',text:'English definition marker.',meaningZh:''}]} pronounce={pronounce}/>), ['English definition marker.']);
});

test('all four usage categories expose all dedicated fields and every paired example', () => {
 const examples = [{id:'1',english:'First example marker.',chinese:'第一译文标记'},{id:'2',english:'Second example marker.',chinese:'第二译文标记'}];
 const points: StructuredUsage[] = [
  {version:2,kind:'scenario',scenario:{name:'场景名称标记',explanation:'场景说明标记',tip:'使用提示标记',examples}},
  {version:2,kind:'grammar',grammar:{name:'规则名称标记',explanation:'规则说明标记',correct:'correct construction marker',restriction:'限制标记',note:'规则补充标记',examples}},
  {version:2,kind:'comparison',comparison:{context:'比较情境标记',difference:'核心区别标记',note:'比较补充标记',expressions:[{id:'a',expression:'first expression marker',explanation:'第一语义说明标记',examples},{id:'b',expression:'second expression marker',explanation:'第二语义说明标记',examples}]}},
  {version:2,kind:'error',error:{name:'错误类型标记',severity:'unnatural',incorrect:'incorrect expression marker',correct:'correct expression marker',reason:'错误原因标记',note:'错误补充标记',examples}},
 ];
 const html = renderToStaticMarkup(<UsageList entries={points.map((point,index)=>usageEntry(String(index),point))} pronounce={pronounce}/>);
 includesFields(html, ['场景名称标记','场景说明标记','使用提示标记','规则名称标记','规则说明标记','correct construction marker','限制标记','规则补充标记','比较情境标记','核心区别标记','比较补充标记','first expression marker','第一语义说明标记','second expression marker','第二语义说明标记','错误类型标记','不够自然','incorrect expression marker','correct expression marker','错误原因标记','错误补充标记','First example marker.','第一译文标记','Second example marker.','第二译文标记']);
 assert.match(html, /usage-grammar-more" open/);
 const sparse = emptyUsage('grammar');
 sparse.grammar = {name:'旧规则标记',explanation:'旧说明标记',examples:[]} as typeof sparse.grammar;
 includesFields(renderToStaticMarkup(<UsageList entries={[usageEntry('sparse',sparse)]} pronounce={pronounce}/>), ['旧规则标记','旧说明标记']);
});

test('old structured usage with a single category and no kind remains visible', () => {
 const old = {id:'old',text:'',meaningZh:'',usage:{version:2,grammar:{name:'保存的规则标记',explanation:'保存的说明标记',examples:[{id:'pair',english:'Saved example marker.'}]}}} as LearningEntry;
 includesFields(renderToStaticMarkup(<UsageList entries={[old]} pronounce={pronounce}/>), ['保存的规则标记','保存的说明标记','Saved example marker.']);
});
