import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PhraseList,UsageList} from '../components/PhraseUsage';
import {basicVocabulary,legacyDetails,mergeGeneratedDetails} from './vocabularyDetails';
import type {LearningEntry} from '../types';
test('expression cards preserve full expressions, meanings, speech and independent bookmark state without repeated categories',()=>{
 const html=renderToStaticMarkup(<PhraseList entries={[{id:'p',text:'a conflict of interest',meaningZh:'利益冲突',category:'collocation'}]} isSaved={()=>true} busy={false} pronounce={()=>{}} onToggle={()=>{}}/>);
 for(const text of ['a conflict of interest','利益冲突','朗读：a conflict of interest','取消收藏：a conflict of interest','aria-pressed="true"','lexicon-phrase-card'])assert.ok(html.includes(text));
 assert.ok(!html.includes('collocation'));
});
test('usage renders a Chinese explanation, optional correction pair and spoken example; legacy prose still renders',()=>{
 const entries:LearningEntry[]=[{id:'u',text:'形容词后的介词',meaningZh:'表示对某人有帮助，可以使用 helpful to someone。',usageKind:'grammar',example:'Your advice was helpful to me.',exampleTranslation:'你的建议对我有帮助。'},{id:'old',text:'旧提示',meaningZh:'旧版说明保留'}];
 const html=renderToStaticMarkup(<UsageList entries={entries} pronounce={()=>{}}/>);
 for(const text of ['常见搭配限制','helpful to someone','朗读例句：Your advice was helpful to me.','旧版说明保留'])assert.ok(html.includes(text));
 assert.ok(!html.includes('误用'));
 const errorHtml=renderToStaticMarkup(<UsageList entries={[{id:'err',text:'纠错',meaningZh:'使用正确结构。',usageKind:'error',contrast:{incorrect:'wrong example',correct:'correct example'}}]} pronounce={()=>{}}/>);
 assert.ok(errorHtml.includes('误用'));assert.ok(errorHtml.includes('正确表达'));
});
test('refreshing expressions preserves other sections; manual usage is retained by default',()=>{
 const current=legacyDetails(basicVocabulary('helpful'));current.sections.usage=[{id:'u',text:'我的标题',meaningZh:'我的解释',usageKind:'grammar'}];current.provenance.usage={source:'user',updatedAt:1};
 const incoming=structuredClone(current);incoming.sections.phrases=[{id:'new',text:'helpful to sb',meaningZh:'对某人有帮助'}];incoming.sections.usage=[];
 const result=mergeGeneratedDetails(current,incoming,'phrases',true);
 assert.deepEqual(result.sections.usage,current.sections.usage);
 assert.deepEqual(result.sections.phrases,incoming.sections.phrases);
 assert.deepEqual(mergeGeneratedDetails(current,incoming).sections.usage,current.sections.usage);
});

test('legacy AI explanations stay visible and intact until explicit regeneration',()=>{
 const entry:LearningEntry={id:'legacy',text:'rooted vs. ingrained',meaningZh:'用法辨析',note:'Rooted often implies origin or structural foundation, while ingrained suggests something so deeply fixed that it is hard to remove.'};
 const before=structuredClone(entry);const html=renderToStaticMarkup(<UsageList entries={[entry]} pronounce={()=>{}}/>);
 assert.ok(!html.includes('<details'));assert.ok(!html.includes('等待更新为中文'));assert.ok(html.includes(entry.note!));assert.deepEqual(entry,before);const manual=renderToStaticMarkup(<UsageList entries={[entry]} manual pronounce={()=>{}}/>);assert.ok(manual.includes(entry.note!));assert.ok(!manual.includes('等待更新为中文'));
 const updated=renderToStaticMarkup(<UsageList entries={[{...entry,meaningZh:'rooted 常用 be rooted in，说明观念或感受与什么有关。',note:'ingrained 更强调习惯难以改变。',example:'Her fear is rooted in an earlier experience.',exampleTranslation:'她的恐惧与过去的一次经历有关。'}]} pronounce={()=>{}}/>);
 assert.ok(!updated.includes('lexicon-usage-legacy'));assert.ok(updated.includes('ingrained 更强调习惯难以改变。'));assert.ok(updated.includes('Her fear is rooted'));
});

test('automatic completion preserves cached usage while explicit section generation replaces it', () => {
 const current = legacyDetails(basicVocabulary('helpful'));
 current.sections.usage = [{id:'old', text:'旧用法', meaningZh:'原有说明'}];
 current.provenance.usage = {source:'ai',updatedAt:1};
 const incoming = structuredClone(current);
 incoming.sections.usage = [{id:'new',text:'常用句型',meaningZh:'新说明',usageKind:'grammar'}];
 assert.deepEqual(mergeGeneratedDetails(current,incoming).sections.usage,current.sections.usage);
 assert.deepEqual(mergeGeneratedDetails(current,incoming,'usage').sections.usage,incoming.sections.usage);
});

test('usage headings follow category order and omit empty sections', () => {
 const entries: LearningEntry[] = [
   {id:'1',text:'模型标题',meaningZh:'解释近义词区别。',usageKind:'comparison'},
   {id:'2',text:'另一个模型标题',meaningZh:'说明实际使用场景。',usageKind:'scenario'},
   {id:'3',text:'空标题',meaningZh:' ',usageKind:'grammar'},
 ];
 const html = renderToStaticMarkup(<UsageList entries={entries} pronounce={()=>{}}/>);
 assert.deepEqual(Array.from(html.matchAll(/<h4>([^<]+)<\/h4>/g), match=>match[1]), ['常见使用场景','容易混淆的近义词']);
 assert.doesNotMatch(html,/模型标题|空标题|常见错误/);
 assert.match(renderToStaticMarkup(<UsageList entries={[entries[2]]} pronounce={()=>{}}/>),/暂无补充用法解析/);
});
