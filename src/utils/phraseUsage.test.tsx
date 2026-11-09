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
 for(const text of ['形容词后的介词','helpful to someone','朗读例句：Your advice was helpful to me.','旧版说明保留'])assert.ok(html.includes(text));
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
