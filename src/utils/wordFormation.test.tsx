import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DerivativeList, RootAnalysis, HighlightedWord } from '../components/WordFormation';
import { inflectionLabel, orderedInflections, legacyDetails, basicVocabulary, mergeGeneratedDetails } from './vocabularyDetails';
import { DefinitionCards } from '../components/DefinitionCards';
import { familyForest, partOfSpeechAbbreviation } from './wordFormation';
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
 assert.equal(html.split('class="lexicon-tree-card lexicon-families"').length-1,1);for(const text of ['有帮助的','无助的','adj.','朗读：helpful','派生关系'])assert.ok(html.includes(text));
});
test('Chinese labels translate legacy API aliases without changing saved word forms or custom labels',()=>{
 for(const [input,expected] of Object.entries({plural:'名词复数','third-person singular':'动词单数','复数':'名词复数','三单':'动词单数','第三人称单数':'动词单数','名词复数':'名词复数','动词单数':'动词单数',past:'过去式',participle:'过去分词','present_participle':'现在分词',comparative:'比较级',superlative:'最高级','自定义':'自定义'}))assert.equal(inflectionLabel(input),expected);
});
test('section regeneration retains structured manual edits and all other sections',()=>{
 const current=legacyDetails(basicVocabulary('helpful'));current.sections.roots=[entry];current.provenance.roots={source:'user',updatedAt:1};
 const incoming=structuredClone(current);incoming.sections.roots=[];
 assert.deepEqual(mergeGeneratedDetails(current,incoming).sections.roots,[entry]);
 assert.deepEqual(mergeGeneratedDetails(current,incoming,'derivatives',true).sections.roots,[entry]);
 assert.deepEqual(mergeGeneratedDetails(current,incoming,'roots',true).sections.roots,[]);
});

test('family tree follows explicit parents, preserves legacy nodes and safely flattens cycles',()=>{
 const make=(text:string,parent?:string):LearningEntry=>({id:text,text,meaningZh:'含义',family:{base:'help',relation:'真实关系',parent}});
 const forest=familyForest([make('helpful','help'),make('helpfulness','helpful'),make('legacy')]);
 assert.equal(forest[0].entry.text,'helpful');assert.equal(forest[0].children[0].entry.text,'helpfulness');assert.equal(forest[1].entry.text,'legacy');
 const cyclic=familyForest([make('a','b'),make('b','a'),make('self','self'),make('missing','unknown')]);assert.equal(cyclic.length,4);
 assert.ok(cyclic.every(node=>node.children.length===0));
});
test('word highlights use supplied real segments only and never guess from similar spelling',()=>{
 const parts=[{kind:'root' as const,text:'help',meaningZh:'帮助'},{kind:'suffix' as const,text:'ful',meaningZh:'具有……性质'}];
 assert.ok(renderToStaticMarkup(<HighlightedWord word="helpful" parts={parts}/>).includes('lexicon-word-part--suffix'));
 const invalid=renderToStaticMarkup(<HighlightedWord word="unrelated" parts={parts}/>);assert.ok(!invalid.includes('lexicon-word-part--'));assert.ok(invalid.includes('unrelated'));
});
test('English definition cards show only ordered English text and left-side speech controls, preserving legacy fields',()=>{
 const entries=[{id:'one',text:'Giving useful assistance.',meaningZh:'隐藏中文',note:'隐藏补充',category:'隐藏标签',partOfSpeech:'adjective'},{id:'two',text:'Making something easier.',meaningZh:'隐藏翻译'}];
 const before=structuredClone(entries);const html=renderToStaticMarkup(<DefinitionCards entries={entries} pronounce={()=>{}}/>);
 for(const hidden of ['隐藏中文','隐藏补充','隐藏标签','隐藏翻译','adjective'])assert.ok(!html.includes(hidden));
 assert.equal(html.split('class="lexicon-definition-card"').length-1,2);assert.ok(html.indexOf('<button')<html.indexOf('<p lang='));assert.deepEqual(entries,before);
 assert.ok(renderToStaticMarkup(<DefinitionCards entries={[{id:'old',text:'只有中文',meaningZh:'旧数据'}]} pronounce={()=>{}}/>).includes('No English definition'));
});
test('POS labels are abbreviated locally without changing stored parts of speech',()=>{
 for(const [input,expected] of Object.entries({adjective:'adj.',noun:'n.',adverb:'adv.',pronoun:'pron.','noun / verb':'n. / v.','intransitive verb':'vi.','形容词':'adj.','custom label':'custom label'}))assert.equal(partOfSpeechAbbreviation(input),expected);
});

test('inflections use a fixed noun-first display order without mutating legacy or manual data',()=>{
 const forms=[{label:'present_participle',value:'conflicting'},{label:'custom note',value:'kept'},{label:'past',value:'conflicted'},{label:'third-person singular',value:'conflicts'},{label:'plural',value:'conflicts'},{label:'participle',value:'conflicted'}];
 const before=structuredClone(forms);
 assert.deepEqual(orderedInflections(forms).map(form=>inflectionLabel(form.label)),['名词复数','动词单数','过去式','过去分词','现在分词','custom note']);
 assert.deepEqual(forms,before);
});
