import React from 'react';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ExampleSenseCards,groupSenseExamples} from '../components/ExampleSenseCards';
import type {LearningEntry} from '../types';
const senses:LearningEntry[]=[{id:'literal',text:'rooted',meaningZh:'扎根的',partOfSpeech:'adjective'},{id:'figurative',text:'rooted',meaningZh:'根深蒂固的',partOfSpeech:'adjective'}];
const examples:LearningEntry[]=[{id:'1',text:'The tree is firmly rooted in the soil.',meaningZh:'这棵树牢牢扎根于土壤中。',senseId:'literal'},{id:'2',text:'This belief is deeply rooted.',meaningZh:'这一信念根深蒂固。',senseId:'figurative'},{id:'3',text:'Old habits are deeply rooted.',meaningZh:'旧习惯根深蒂固。',senseId:'figurative'}];
test('sentences group by stable meaning IDs into POS-and-Chinese headings without collocation titles',()=>{
 const groups=groupSenseExamples(examples,senses);assert.equal(groups.length,2);assert.deepEqual(groups.map(g=>g.examples.length),[1,2]);
 const html=renderToStaticMarkup(<ExampleSenseCards entries={examples} senses={senses} isSaved={()=>false} busy={false} pronounce={()=>{}} onToggle={()=>{}}/>);
 assert.equal(html.split('class="lexicon-sense-card"').length-1,2);assert.ok(html.includes('adj.</span>扎根的'));assert.ok(html.includes('adj.</span>根深蒂固的'));
 for(const entry of examples){assert.ok(html.includes(`朗读：${entry.text}`));assert.ok(html.includes(`收藏：${entry.text}`));}
});
test('legacy collocation-plus-example shape displays the real sentence and preserves its old bookmark key',()=>{
 const legacy:LearningEntry={id:'old',text:'deeply rooted',meaningZh:'根深蒂固的',example:'These customs are deeply rooted in our culture.',exampleTranslation:'这些习俗在我们的文化中根深蒂固。'};
 const before=structuredClone(legacy);const group=groupSenseExamples([legacy],senses,'adjective')[0];assert.equal(group.meaning,'根深蒂固的');assert.equal(group.examples[0].legacyKey,'deeply rooted');assert.equal(group.examples[0].sentence,legacy.example);
 const html=renderToStaticMarkup(<ExampleSenseCards entries={[legacy]} senses={senses} defaultPos="adjective" isSaved={text=>text==='deeply rooted'} busy={false} pronounce={()=>{}} onToggle={()=>{}}/>);
 assert.ok(html.includes('adj.</span>根深蒂固的'));assert.ok(html.includes(`取消收藏：${legacy.example}`));assert.ok(!html.includes('>deeply rooted</p>'));assert.deepEqual(legacy,before);
});
test('unknown sense associations do not invent meanings or drop saved sentences',()=>{
 const result=groupSenseExamples([{id:'old',text:'An existing sentence.',meaningZh:'原译文',senseId:'missing'}],senses);assert.equal(result[0].meaning,'');assert.equal(result[0].examples[0].translation,'原译文');
});

test('legacy bookmarks remain cancellable while new bookmarks use the actual spoken sentence and translation',()=>{
 const old:LearningEntry={id:'legacy',text:'deeply rooted',meaningZh:'根深蒂固的',example:'These customs are deeply rooted.',exampleTranslation:'这些习俗根深蒂固。'};
 const findButton=(node:any):any=>{if(!node||typeof node!=='object')return; if(node.type==='button'&&node.props['aria-pressed']!==undefined)return node;for(const child of React.Children.toArray(node.props?.children)){const result=findButton(child);if(result)return result;}};
 for(const saved of [false,true]){let chosen:LearningEntry|undefined;const tree=ExampleSenseCards({entries:[old],senses,defaultPos:'adjective',isSaved:text=>saved&&text===old.text,busy:false,pronounce:()=>{},onToggle:entry=>{chosen=entry;}});findButton(tree).props.onClick();assert.equal(chosen?.text,saved?old.text:old.example);assert.equal(chosen?.meaningZh,saved?old.meaningZh:old.exampleTranslation);}
});

test('precise example labels split an old combined sense without rewriting its ID or saved meaning',()=>{
 const combined:LearningEntry[]=[{id:'old-sense',text:'rooted',meaningZh:'扎根的；根深蒂固的',partOfSpeech:'adjective'}];const before=structuredClone(combined);
 const entries=examples.slice(0,2).map((entry,i)=>({...entry,senseId:'old-sense',senseMeaningZh:i===0?'扎根的':'根深蒂固的'}));
 const groups=groupSenseExamples(entries,combined);assert.deepEqual(groups.map(g=>g.meaning),['扎根的','根深蒂固的']);assert.deepEqual(combined,before);
});
