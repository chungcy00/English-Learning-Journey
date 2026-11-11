import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DerivativeList, RootAnalysis, HighlightedWord } from '../components/WordFormation';
import { inflectionLabel, orderedInflections, legacyDetails, basicVocabulary, mergeGeneratedDetails } from './vocabularyDetails';
import { DefinitionCards } from '../components/DefinitionCards';
import { derivativeDiagramBase, familyForest, partOfSpeechAbbreviation } from './wordFormation';
import type { LearningEntry } from '../types';
const helpParts = (word: string): NonNullable<LearningEntry['family']>['parts'] => [
 {kind:'root',text:'help',meaningZh:'帮助'},
 ...({ helpful:['ful'], helpless:['less'], helpfulness:['ful','ness'] }[word] || []).map(text => ({kind:'suffix' as const,text,meaningZh:text})),
];
const entry: LearningEntry={id:'root',text:'help',meaningZh:'帮助',morphology:{root:'help',meaningZh:'帮助',parts:[{kind:'root',text:'help',meaningZh:'帮助'},{kind:'suffix',text:'ful',meaningZh:'具有……性质的'}],explanation:'构成有帮助的含义。',mnemonic:'记住一个乐于帮助的人。',related:[{word:'helpless',partOfSpeech:'adjective',meaningZh:'无助的',parts:helpParts('helpless')}]}};
test('root rendering separates true formation from memory and exposes labels, color hooks and same-root speech',()=>{
 const html=renderToStaticMarkup(<RootAnalysis entry={entry} term="helpful" pronounce={()=>{}}/>);
 for(const text of ['辅助记忆联想','词根','后缀','同根词','lexicon-word-part--root','朗读：helpless'])assert.ok(html.includes(text));
 assert.ok(renderToStaticMarkup(<RootAnalysis entry={{id:'old',text:'旧资料',meaningZh:'原有内容'}} term="helpful" pronounce={()=>{}}/>).includes('原有内容'));
});
test('derivatives are grouped by lexical base and render separate word, POS, meaning and pronunciation',()=>{
 const family={base:'help',relation:'派生关系'};
 const html=renderToStaticMarkup(<DerivativeList entries={[{id:'1',text:'helpful',partOfSpeech:'adjective',meaningZh:'有帮助的',family:{...family,parts:helpParts('helpful')}},{id:'2',text:'helpless',partOfSpeech:'adjective',meaningZh:'无助的',family:{...family,parts:helpParts('helpless')}}]} pronounce={()=>{}}/>);
 assert.equal(html.split('class="lexicon-tree-card lexicon-families"').length-1,1);for(const text of ['有帮助的','词族关联','adj.','朗读：helpful','派生关系'])assert.ok(html.includes(text));
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

test('diagram uses explicit family evidence and groups unknown and cyclic entries without asserting a direct link', () => {
 const make = (text:string,parent?:string):LearningEntry => ({id:text,text,meaningZh:'释义',family:{base:'help',relation:'已有关系',parent,parts:helpParts(text)}});
 const entries = [make('helpful','help'),make('helpfulness','helpful'),make('helpless')];
 assert.equal(derivativeDiagramBase(entries,'help',[]),'help');
 const html = renderToStaticMarkup(<DerivativeList entries={entries} term="help" pronounce={()=>{}}/>);
 assert.equal((html.match(/data-direct="true"/g) || []).length,2);
 assert.equal((html.match(/data-direct="false"/g) || []).length,1);
 assert.equal(derivativeDiagramBase(entries,'help',['helpfulness']),undefined);
 for (const bad of [[make('helpful','unknown')],[make('helpful','helpfulness'),make('helpfulness','helpful')]]) {
  assert.equal(derivativeDiagramBase(bad,'help',[]),undefined);
  const grouped = renderToStaticMarkup(<DerivativeList entries={bad} term="help" pronounce={()=>{}}/>);
  assert.match(grouped, /本栏收录/);
  assert.doesNotMatch(grouped, /data-direct="true"/);
 }
});

test('historical-only related words and explanations are hidden', () => {
 const morphology = { ...entry.morphology!, root:'hesit', parts:[{kind:'root' as const,text:'hesit',meaningZh:'犹豫'},{kind:'suffix' as const,text:'ate',meaningZh:'动词后缀'}],
  explanation:'表示做事前有所犹豫。这个词源于拉丁语。',
  related:['adhere','inherent','inherit'].map(word => ({word,partOfSpeech:'verb',meaningZh:'示例',relation:'未经核实的旧说明'})),
 };
 const html = renderToStaticMarkup(<RootAnalysis entry={{...entry,morphology}} term="hesitate" pronounce={()=>{}}/>);
 assert.match(html,/做事前有所犹豫/);
 assert.doesNotMatch(html,/adhere|inherent|inherit|历史同源词|拉丁语|lexicon-family-diagram/);
 const historicalExplanation = {...morphology, explanation:'这个词源于拉丁语。'};
 const restored = renderToStaticMarkup(<RootAnalysis entry={{...entry,morphology:historicalExplanation}} term="hesitate" pronounce={()=>{}}/>);
 assert.match(restored,/lexicon-part-meanings/);
 assert.doesNotMatch(restored,/真实构词分析/);
 assert.match(restored,/辅助记忆联想/);
 assert.doesNotMatch(restored,/拉丁语|历史同源词/);
 const historicalOnly = {...historicalExplanation, meaningZh:'拉丁语词根', mnemonic:'',
   parts:morphology.parts.map(part => ({...part, meaningZh:'拉丁语构词'}))};
 assert.equal(renderToStaticMarkup(<RootAnalysis entry={{...entry,morphology:historicalOnly}} term="hesitate" pronounce={()=>{}}/>),'');
});

test('cached rooted derivatives use the root tree even with a single entry and no family metadata', () => {
 const rootless = { id: 'rootless', text: 'rootless', meaningZh: '无根的' };
 const rootlessly = { id: 'rootlessly', text: 'rootlessly', meaningZh: '漂泊不定地' };
 for (const entries of [[rootless], [rootlessly], [rootlessly, rootless]]) {
  const html = renderToStaticMarkup(<DerivativeList entries={entries} term="rooted" pronounce={()=>{}}/>);
  assert.doesNotMatch(html, /本栏收录/);
  assert.match(html, /lexicon-family-base[^>]* lang="en"[^>]*>.*root<\/div>/);
  assert.equal((html.match(/class="lexicon-family-branch"/g) ?? []).length, entries.length);
  if (entries.length === 2) assert.match(html, /rootless<\/span><\/button><ul class="lexicon-family-branches"/);
 }
});

test('root summary with extra glosses is merged into the breakdown instead of repeated above it', () => {
 const morphology = { ...entry.morphology!, root: 'vast', meaningZh: '巨大的，空旷的', related: [],
  parts: [{kind: 'root' as const, text: 'vast', meaningZh: '巨大的'}, {kind: 'suffix' as const, text: 'ness', meaningZh: '表示性质'}],
 };
 const html = renderToStaticMarkup(<RootAnalysis entry={{...entry,morphology}} term="vastness" pronounce={()=>{}}/>);
 assert.doesNotMatch(html, /lexicon-core-root/);
 assert.match(html, /<dd>巨大的、空旷的<\/dd>/);
});

test('one supported derivative still forms a tree when another old entry has no construction data', () => {
 const entries = [
  { id: 'legacy', text: 'hopefulness', meaningZh: '满怀希望' },
  { id: 'supported', text: 'hopeful', meaningZh: '有希望的', family: { base: 'hope', parent: 'hope', relation: '加 -ful', parts: [
   { kind: 'root' as const, text: 'hope', meaningZh: '希望' },
   { kind: 'suffix' as const, text: 'ful', meaningZh: '充满' },
  ] } },
 ];
 const html = renderToStaticMarkup(<DerivativeList entries={entries} term="hope" pronounce={()=>{}}/>);
 assert.equal((html.match(/class="lexicon-family-branch"/g) ?? []).length, 2);
 assert.match(html, /本栏收录.*hopefulness/);
});

test('cached capacity words form a tree without claiming direct derivation from capacity', () => {
 const incapacity = { id: 'incapacity', text: 'incapacity', meaningZh: '无能力' };
 const incapacitate = { id: 'incapacitate', text: 'incapacitate', meaningZh: '使失去能力' };
 for (const entries of [[incapacity], [incapacitate], [incapacity, incapacitate]]) {
  const html = renderToStaticMarkup(<DerivativeList entries={entries} term="capacity" pronounce={()=>{}}/>);
  assert.doesNotMatch(html, /本栏收录/);
  assert.equal((html.match(/class="lexicon-family-branch"/g) ?? []).length, entries.length);
  assert.match(html, /data-direct="false"/);
  if (entries.length === 2) assert.match(html, /incapacity<\/span><\/button><ul class="lexicon-family-branches"><li[^>]*data-direct="true"/);
 }
});
