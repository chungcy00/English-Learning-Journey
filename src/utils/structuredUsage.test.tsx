import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UsageList } from '../components/UsageAnalysis';
import { UsageEditor } from '../components/UsageEditor';
import { emptyUsage, structuredUsage, upgradeUsageDetails, usageEntry, usageValidationError } from './structuredUsage';
import type { LearningEntry } from '../types';

test('historical usage is converted losslessly and conversion is idempotent', () => {
  const entry = { id:'old', text:'in 与 with', meaningZh:'in 表示介入事务，with 表示妨碍过程。', usageKind:'grammar', example:'Do not interfere with the equipment.', exampleTranslation:'不要干扰设备。', note:'注意介词。', customField:{ keep:['all',1] } } as LearningEntry;
  const result = structuredUsage(entry);
  assert.deepEqual(result.compatibility?.original, {});
  assert.equal(result.grammar?.explanation, entry.meaningZh);
  assert.equal(result.grammar?.examples[0].chinese, entry.exampleTranslation);
  assert.equal(result.compatibility?.title, entry.text);
  assert.equal(result.compatibility!.extra,'');
  assert.deepEqual(structuredUsage(usageEntry(entry.id,result)),result);
  assert.equal(usageValidationError(result),undefined);
  assert.equal(entry.text,'in 与 with');
});
test('unknown categories and partial or unattributed historical examples remain editable', () => {
  const raw = {id:'old',text:'自然表达',meaningZh:'完整旧说明',usageKind:'natural',example:'A full sentence.',note:'旧备注'} as LearningEntry;
  const converted=structuredUsage(raw);
  assert.equal(converted.kind,undefined);
  assert.equal(converted.compatibility?.explanation,raw.meaningZh);
  assert.equal(converted.compatibility?.examples[0].english,raw.example);
  assert.equal(converted.compatibility?.examples[0].chinese,'');
  const comparison=structuredUsage({...raw,usageKind:'comparison',exampleTranslation:'完整译文'});
  assert.deepEqual(comparison.comparison?.expressions,[]);
  assert.equal(comparison.compatibility,undefined);
  const html=renderToStaticMarkup(<UsageEditor entries={[usageEntry(raw.id,converted)]} onChange={()=>{}}/>);
  assert.match(html,/历史说明/); assert.match(html,/完整旧说明/);
  assert.doesNotMatch(html,/语体差异（旧版）|自然表达（旧版）/);
});
test('new paired examples validate together and inactive categories survive serialization', () => {
  const usage=emptyUsage('scenario');
  usage.scenario={name:'团队讨论',explanation:'用于描述参加讨论。',tip:'',examples:[{id:'a',english:'Join the discussion.',chinese:''}]};
  assert.match(usageValidationError(usage)!,/同时填写/);
  usage.scenario.examples[0].chinese='参加讨论。';
  assert.equal(usageValidationError(usage),undefined);
  usage.kind='grammar'; usage.grammar={name:'参与',explanation:'说明搭配规则。',correct:'take part in',restriction:'',note:'',examples:[]};
  const roundtrip=JSON.parse(JSON.stringify(usageEntry('a',usage)));
  assert.deepEqual(structuredUsage(roundtrip).scenario,usage.scenario);
});
test('structured display preserves multiple projects, comparisons, pairing and fixed category order',()=>{
  const scenario=emptyUsage(); scenario.scenario={name:'讨论',explanation:'用于团队讨论。',tip:'',examples:[{id:'1',english:'We discussed it.',chinese:'我们讨论了此事。'},{id:'2',english:'They joined us.',chinese:'他们加入了我们。'}]};
  const comparison=emptyUsage('comparison'); comparison.comparison={context:'参与事务',difference:'三个表达的主动程度不同。',note:'',expressions:[{id:'e1',expression:'get involved in',explanation:'参与。强调参与。',examples:[]},{id:'e2',expression:'interfere in',explanation:'干涉。强调主动插手。',examples:[]}]};
  const html=renderToStaticMarkup(<UsageList entries={[usageEntry('c',comparison),usageEntry('s',scenario),usageEntry('s2',scenario)]} pronounce={()=>{}}/>);
  assert.ok(html.indexOf('常见使用场景')<html.indexOf('容易混淆的近义词'));
  assert.equal((html.match(/data-usage-kind="scenario"/g)||[]).length,2);
  assert.match(html,/We discussed it\.<\/p><p[^>]*>我们讨论了此事。/);
  assert.match(html,/朗读：get involved in/);
  assert.match(html,/强调主动插手/);
});
test('empty optional categories hide their titles and use one compact empty message',()=>{
 const html=renderToStaticMarkup(<UsageList entries={[usageEntry('empty',emptyUsage('comparison'))]} pronounce={()=>{}}/>);
 assert.match(html,/暂无补充用法解析/);assert.doesNotMatch(html,/容易混淆的近义词/);
});
test('comparison merges old meaning and emphasis into one explanation and removes legacy remnants',()=>{
 const old={id:'c',text:'容易混淆的近义词',meaningZh:'',usage:{version:2,kind:'comparison',comparison:{context:'朋友争执',difference:'参与的主动性不同。',note:'',expressions:[{id:'e',expression:'interfere in',meaning:'干涉，插手',emphasis:'强调主动介入别人的事务。',examples:[]}]},compatibility:{title:'旧标题',explanation:'旧说明',note:'',examples:[],extra:'旧字段',original:{text:'旧资料'}}}} as unknown as LearningEntry;
 const converted=structuredUsage(old);
 assert.deepEqual(converted.comparison?.expressions[0],{id:'e',expression:'interfere in',explanation:'干涉，插手。强调主动介入别人的事务。',examples:[]});
 assert.equal(converted.compatibility,undefined);
 const normalized=usageEntry('c',converted);
 assert.deepEqual(structuredUsage(normalized),converted);
 const html=renderToStaticMarkup(<UsageList entries={[normalized]} pronounce={()=>{}}/>);
 assert.equal((html.match(/usage-semantic-explanation/g)||[]).length,1);
 assert.doesNotMatch(html,/旧标题|旧说明|其他历史资料/);
 const editor=renderToStaticMarkup(<UsageEditor entries={[normalized]} onChange={()=>{}}/>);
 assert.match(editor,/中文语义说明/);assert.doesNotMatch(editor,/中文意思|语义侧重点|保留的历史内容/);
 assert.match(html,/朗读：interfere in/);
});
test('comparison normalization removes only exact repeated information and preserves manual explanations',()=>{
 const old={id:'c',text:'',meaningZh:'',usage:{version:2,kind:'comparison',comparison:{context:'事务',difference:'区别',note:'',expressions:[{id:'e',expression:'interfere',explanation:'干涉，强调主动插手。',meaning:'干涉',emphasis:'干涉，强调主动插手。',examples:[]}]}}} as unknown as LearningEntry;
 assert.equal(structuredUsage(old).comparison?.expressions[0].explanation,'干涉，强调主动插手。');
 const other=structuredUsage({...old,usage:{...old.usage!,kind:'grammar',grammar:{name:'规则',explanation:'说明。',correct:'frame',restriction:'',note:'',examples:[]},compatibility:{title:'保留其他类别',explanation:'原文',examples:[],note:'',extra:'',original:{}}}});
 assert.equal(other.compatibility?.title,'保留其他类别');
});
