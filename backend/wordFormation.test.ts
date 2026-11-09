import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDetails, detailsSchema } from './learningSchemas';
import { DETAILS } from './testLearningFixtures';
const morphology = { root: 'help', meaningZh: '帮助', parts: [{ kind:'root', text:'help', meaningZh:'帮助' }, { kind:'suffix', text:'ful', meaningZh:'具有……性质的' }], explanation:'help 加形容词后缀 -ful，表示有帮助的。', mnemonic:'想象一个乐于帮助别人的人。', related:[{word:'helpless',partOfSpeech:'adjective',meaningZh:'无助的'}] };
function output() { return { ...structuredClone(DETAILS), term:'helpful', inflections:[{label:'comparative',value:'more helpful'}], sections:{...structuredClone(DETAILS.sections), roots:[{text:'help',meaningZh:'帮助',morphology:structuredClone(morphology)}], derivatives:[{text:'helpfulness',meaningZh:'乐于助人',partOfSpeech:'noun',family:{base:'help',relation:'helpful 加 -ness 构成名词'}}] } }; }
test('morphology and derivational relationships survive schema validation; unrelated sections retain their content', () => {
  const input=output(); const result=validateDetails(input,'helpful','word');
  assert.deepEqual(result.sections.roots[0].morphology,morphology);
  assert.deepEqual(result.sections.derivatives[0].family,input.sections.derivatives[0].family);
  assert.equal(result.inflections[0].label,'比较级');
  for(const key of ['examples','phrases','definitions','usage'] as const) assert.deepEqual(result.sections[key].map(({id,senseId,...entry})=>entry),input.sections[key].map(entry=>({...entry,partOfSpeech:entry.partOfSpeech||'',example:entry.example||'',exampleTranslation:entry.exampleTranslation||'',note:entry.note||'',category:entry.category||''})));
  assert.ok((detailsSchema.properties.sections.properties.roots.items.properties as any).morphology);
});
test('mismatched segmentation, invented part categories and incomplete relationships are rejected', () => {
  for(const change of [(m:any)=>m.parts[0].text='fake', (m:any)=>m.parts[0].kind='syllable',(m:any)=>m.parts[0].kind='prefix',(m:any)=>m.related=[{word:'hello'}]]) {
    const input=output(); change(input.sections.roots[0].morphology); assert.throws(()=>validateDetails(input,'helpful','word'));
  }
  const input=output(); input.sections.derivatives[0].family.relation=''; assert.throws(()=>validateDetails(input,'helpful','word'));
});
test('ordinary forms, duplicate derivatives and original word are excluded without removing valid family members', () => {
  const input=output(); input.sections.derivatives.push(...['helpful','more helpful','helpfulness'].map(text=>({...input.sections.derivatives[0],text})));
  assert.deepEqual(validateDetails(input,'helpful','word').sections.derivatives.map(entry=>entry.text),['helpfulness']);
});
test('legacy prose and empty roots/derivatives remain compatible without fabricated structured data', () => {
  const legacy={...DETAILS,sections:{...DETAILS.sections,roots:[{text:'legacy note',meaningZh:'旧有分析'}]}};
  assert.equal(validateDetails(legacy,'conflict','word').sections.roots[0].morphology,undefined);
  assert.equal(validateDetails(DETAILS,'conflict','word').sections.roots.length,0);
});
test('practical expressions preserve articles and prepositions, and usage carries explanation and genuine corrections', () => {
  const input:any=output();
  input.sections.phrases=[{text:'a conflict of interest',meaningZh:'利益冲突',category:'fixed-expression'},{text:'come into conflict with sb',meaningZh:'与某人发生冲突'}];
  input.sections.usage=[{text:'避免把 conflict 当作可直接接宾语的动词',meaningZh:'动词 conflict 通常使用 conflict with，表示冲突或不一致。',usageKind:'grammar',example:'Their schedules conflict with each other.',exampleTranslation:'他们的时间安排相互冲突。'},{text:'介词搭配错误',meaningZh:'表示与某事冲突时，使用 with。',usageKind:'error',contrast:{incorrect:'conflict to the rule',correct:'conflict with the rule'}}];
  const result=validateDetails(input,'helpful','word');
  assert.equal(result.sections.phrases[0].text,'a conflict of interest');
  assert.equal(result.sections.phrases[1].text,'come into conflict with sb');
  assert.equal(result.sections.usage[0].usageKind,'grammar');
  assert.deepEqual(result.sections.usage[1].contrast,input.sections.usage[1].contrast);
});
test('invalid usage categories and wrong/correct pairs on mere style preferences are rejected',()=>{
  const input:any=output();input.sections.usage=[{text:'发音',meaningZh:'重音规则',usageKind:'pronunciation'}];
  assert.throws(()=>validateDetails(input,'helpful','word'));
  input.sections.usage=[{text:'语体',meaningZh:'正式程度不同',usageKind:'register',contrast:{incorrect:'one option',correct:'another valid option'}}];
  assert.throws(()=>validateDetails(input,'helpful','word'));
  input.sections.usage=[{text:'旧版提示',meaningZh:'保留原内容'}];assert.equal(validateDetails(input,'helpful','word').sections.usage[0].usageKind,undefined);
});
test('new AI responses must include structured learning fields while legacy cache validation stays permissive',()=>{
 const input=output();
 assert.doesNotThrow(()=>validateDetails(input,'helpful','word',[],true));
 const old:any=structuredClone(input);delete old.sections.roots[0].morphology;
 assert.doesNotThrow(()=>validateDetails(old,'helpful','word'));
 assert.throws(()=>validateDetails(old,'helpful','word',[],true));
});
test('dictionary affix notation is normalized only if the resulting segments exactly reconstruct the word',()=>{
 const input=output();input.sections.roots[0].morphology.parts[1].text='-ful';
 const result=validateDetails(input,'helpful','word',[],true);assert.equal(result.sections.roots[0].morphology?.parts[1].text,'ful');
 input.sections.roots[0].morphology.parts[0].text='invented-';assert.throws(()=>validateDetails(input,'helpful','word',[],true));
});
test('empty optional correction placeholders are omitted rather than rendered as false errors',()=>{
 const input:any=output();input.sections.usage=[{text:'语体说明',meaningZh:'按场景选择表达。',usageKind:'register',contrast:{incorrect:'',correct:''}}];
 assert.equal(validateDetails(input,'helpful','word',[],true).sections.usage[0].contrast,undefined);
});
test('misclassified pronunciation notes cannot appear in usage, while genuine grammar explanations remain',()=>{
 const input:any=output();input.sections.usage=[{text:'词性重音差异',meaningZh:'名词和动词重音不同。',usageKind:'grammar'},{text:'与 conflict over 的区别',meaningZh:'conflict with 指与人或安排不一致，over 引出争议事项。',usageKind:'comparison',example:'They are in conflict over the budget.'}];
 const result=validateDetails(input,'helpful','word',[],true);assert.equal(result.sections.usage.length,1);assert.equal(result.sections.usage[0].usageKind,'comparison');
});
