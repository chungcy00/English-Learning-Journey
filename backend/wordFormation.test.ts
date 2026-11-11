import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDetails, detailsSchema, detailsSchemaForSection, isolateRequestedSection } from './learningSchemas';

test('Gemini full and section response schemas never contain rejected empty enum members',()=>{
 const inspect=(value:any)=>{
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value.enum))assert.ok(value.enum.every((item:any)=>item!==''),'Gemini rejects empty enum members');
  for(const nested of Object.values(value))inspect(nested);
 };
 inspect(detailsSchema);
 for(const section of ['examples','derivatives','roots','phrases','definitions','usage'] as const)inspect(detailsSchemaForSection(section));
});
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
test('invalid usage categories are rejected and style alternatives are never displayed as errors',()=>{
  const input:any=output();input.sections.usage=[{text:'发音',meaningZh:'重音规则',usageKind:'pronunciation'}];
  assert.throws(()=>validateDetails(input,'helpful','word'));
  input.sections.usage=[{text:'语体',meaningZh:'正式程度不同',usageKind:'register',contrast:{incorrect:'one option',correct:'another valid option'}}];
  assert.equal(validateDetails(input,'helpful','word').sections.usage[0].contrast,undefined);
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
 const input:any=output();input.sections.usage=[{text:'场景说明',meaningZh:'按场景选择表达。',usageKind:'scenario',contrast:{incorrect:'',correct:''}}];
 assert.equal(validateDetails(input,'helpful','word',[],true).sections.usage[0].contrast,undefined);
});
test('misclassified pronunciation notes cannot appear in usage, while genuine grammar explanations remain',()=>{
 const input:any=output();input.sections.usage=[{text:'词性重音差异',meaningZh:'名词和动词重音不同。',usageKind:'grammar'},{text:'与 conflict over 的区别',meaningZh:'conflict with 指与人或安排不一致，over 引出争议事项。',usageKind:'comparison',example:'They are in conflict over the budget.'}];
 const result=validateDetails(input,'helpful','word',[],true);assert.equal(result.sections.usage.length,1);assert.equal(result.sections.usage[0].usageKind,'comparison');
});
test('new analyses require Chinese explanations and omit the original word and duplicate same-root entries',()=>{
 const input=output();input.sections.roots[0].morphology.related.push({word:'helpful',partOfSpeech:'adjective',meaningZh:'有帮助的'},{word:'helpless',partOfSpeech:'adjective',meaningZh:'无助的'});
 const result=validateDetails(input,'helpful','word',[],true);
 assert.deepEqual(result.sections.roots[0].morphology?.related.map(word=>word.word),['helpless']);
 input.sections.roots[0].morphology.explanation='Derived from help with ful.';
 assert.throws(()=>validateDetails(input,'helpful','word',[],true),/构词拆解/);
 const wrong=output();wrong.sections.derivatives[0].family.relation='suffixed with -fulness';
 assert.throws(()=>validateDetails(wrong,'helpful','word',[],true),/派生词/);
});
test('section refresh excludes known cached inflections even if the new response omits its inflections list',()=>{
 const input:any=output();input.term='help';input.inflections=[];input.sections.roots=[];input.sections.derivatives=[{text:'helping',meaningZh:'帮助中',partOfSpeech:'participle',family:{base:'help',relation:'现在分词'}},{text:'helper',meaningZh:'帮手',partOfSpeech:'noun',family:{base:'help',relation:'help 加 -er，表示提供帮助的人'}}];
 assert.deepEqual(validateDetails(input,'help','word',[],true,[{label:'现在分词',value:'helping'}]).sections.derivatives.map(entry=>entry.text),['helper']);
});
test('an English legacy stress-change heading is excluded even when mislabeled as grammar',()=>{
 const input:any=output();input.sections.usage=[{text:'Note the stress change: noun vs verb.',meaningZh:'注意重音变化。',usageKind:'grammar'},{text:'动词与名词句型',meaningZh:'动词用 conflict with，名词结构用 be in conflict with。',usageKind:'grammar'}];
 assert.deepEqual(validateDetails(input,'helpful','word',[],true).sections.usage.map(entry=>entry.text),['常见搭配限制']);
});
test('new phrase/usage meanings must be Chinese, and identical expressions are deduplicated without stripping articles',()=>{
 const input:any=output();input.sections.phrases=[{text:'a conflict of interest',meaningZh:'利益冲突'},{text:'a  conflict of interest',meaningZh:'利益冲突'}];
 assert.deepEqual(validateDetails(input,'helpful','word',[],true).sections.phrases.map(entry=>entry.text),['a conflict of interest']);
 input.sections.phrases[0].meaningZh='a clash of interests';assert.throws(()=>validateDetails(input,'helpful','word',[],true),/简体中文/);
 const old:any=output();old.sections.usage=[{text:'legacy',meaningZh:'legacy prose'}];assert.doesNotThrow(()=>validateDetails(old,'helpful','word'));
});

test('new error entries require a complete, distinct correction pair',()=>{
 for(const contrast of [{}, {incorrect:'bad'}, {incorrect:'same',correct:'same'}, {incorrect:null,correct:''}]) {
  const input:any=output(); input.sections.usage=[{text:'句型说明',meaningZh:'解释完整句法及真实使用场景。',usageKind:'error',contrast}];
  assert.deepEqual(validateDetails(input,'helpful','word',[],true).sections.usage, []);
 }
});
test('section refresh schema and validation isolate the selected column from unrelated generated content',()=>{
 const schema=detailsSchemaForSection('usage');assert.deepEqual(Object.keys(schema.properties.sections.properties),['usage']);
 assert.deepEqual(schema.properties.sections.required,['usage']);assert.equal(detailsSchemaForSection(),detailsSchema);
 const input:any=output();input.sections.usage=[{text:'句型说明',meaningZh:'实际语法用法',usageKind:'grammar'}];input.sections.roots=[{broken:true}];
 const result=validateDetails(isolateRequestedSection(input,'usage'),'helpful','word',[],true);
 assert.equal(result.sections.usage.length,1);assert.deepEqual(result.sections.roots,[]);assert.deepEqual(result.sections.derivatives,[]);
 delete input.sections.usage;assert.throws(()=>validateDetails(isolateRequestedSection(input,'usage'),'helpful','word',[],true));
});

test('new tree metadata survives normalization without inventing legacy parents or segments',()=>{
 const input:any=output();input.sections.derivatives[0].family={base:'help',parent:'helpful',relation:'helpful 加 -ness 构成名词',parts:[{kind:'root',text:'helpful',meaningZh:'有帮助的'},{kind:'suffix',text:'ness',meaningZh:'性质或状态'}]};
 input.sections.roots[0].morphology.related[0]={word:'helpless',partOfSpeech:'adjective',meaningZh:'无助的',relation:'共同词根 help，加 -less 表示缺少',parts:[{kind:'root',text:'help',meaningZh:'帮助'},{kind:'suffix',text:'less',meaningZh:'缺少'}]};
 const result=validateDetails(input,'helpful','word',[],true);assert.equal(result.sections.derivatives[0].family?.parent,'helpful');assert.equal(result.sections.derivatives[0].family?.parts?.length,2);assert.ok(result.sections.roots[0].morphology?.related[0].relation?.includes('help'));
 input.sections.derivatives[0].family.parts[0].text='invented';assert.throws(()=>validateDetails(input,'helpful','word',[],true),/派生词分段/);
 const old=validateDetails(output(),'helpful','word');assert.equal(old.sections.derivatives[0].family?.parent,undefined);
});
test('English definitions reject new translations while preserving legacy translated records',()=>{
 const input:any=output();input.sections.definitions=[{text:'Giving useful assistance.',meaningZh:''}];assert.doesNotThrow(()=>validateDetails(input,'helpful','word',[],true));
 input.sections.definitions[0].meaningZh='有帮助的';assert.throws(()=>validateDetails(input,'helpful','word',[],true),/纯英文/);assert.doesNotThrow(()=>validateDetails(input,'helpful','word'));
 input.sections.definitions[0]={text:'有帮助的',meaningZh:''};assert.throws(()=>validateDetails(input,'helpful','word',[],true),/纯英文/);
});

test('new cyclic derivational relationships are rejected rather than shown as real hierarchy',()=>{
 const input:any=output();input.sections.derivatives=[{text:'helpful',meaningZh:'有帮助的',partOfSpeech:'adjective',family:{base:'help',parent:'helpfulness',relation:'测试关系'}},{text:'helpfulness',meaningZh:'有帮助',partOfSpeech:'noun',family:{base:'help',parent:'helpful',relation:'测试关系'}}];
 input.term='help';input.sections.roots=[];assert.throws(()=>validateDetails(input,'help','word',[],true),/循环/);
});

test('examples retain precise word-meaning labels without changing the original combined sense',()=>{
 const input:any=output();input.senses=[{text:'helpful',meaningZh:'有帮助的；乐于助人的',partOfSpeech:'adjective',senseId:'old'}];input.sections.examples=[{text:'Your explanation was helpful.',meaningZh:'你的解释很有帮助。',senseId:'old',senseMeaningZh:'有帮助的'}];
 const result=validateDetails(input,'helpful','word',[],true);assert.equal(result.senses[0].meaningZh,'有帮助的；乐于助人的');assert.equal(result.sections.examples[0].senseMeaningZh,'有帮助的');assert.equal(result.sections.examples[0].senseId,result.senses[0].id);
});

test('new usage explanatory fields require Chinese even when the main explanation is already Chinese',()=>{
 const input:any=output();input.sections.usage=[{text:'近义词区别',meaningZh:'rooted 常用来说明观念或感受与什么有关。',usageKind:'comparison',note:'Rooted often implies origin or structural foundation, while ingrained suggests something deeply fixed.'}];
 assert.throws(()=>validateDetails(input,'helpful','word',[],true),/简明中文/);
 assert.doesNotThrow(()=>validateDetails(input,'helpful','word'));
 input.sections.usage[0].note='ingrained 更强调习惯或观念长期形成、很难改变。';assert.doesNotThrow(()=>validateDetails(input,'helpful','word',[],true));
 input.sections.usage[0].exampleTranslation='This English paragraph belongs in the example field, not in the Chinese translation field.';assert.throws(()=>validateDetails(input,'helpful','word',[],true),/简明中文/);
});

test('new usage allows zero or one direction, deduplicates explanations, and retains legacy categories only for old data', () => {
 const input = output();
 const point = { text:'语境说明', meaningZh:'用于说明建议对某人有帮助。', usageKind:'scenario' };
 input.sections.usage = [];
 assert.deepEqual(validateDetails(input,'helpful','word',[],true).sections.usage, []);
 input.sections.usage = [point, {...point, text:'另一个标题'}, {
   text:'搭配用法', meaningZh:'常用搭配包括 give advice（提供建议）以及 take advice（采纳建议）。', usageKind:'scenario',
 }];
 assert.equal(validateDetails(input,'helpful','word',[],true).sections.usage.length, 1);
 input.sections.usage = Array(5).fill(point);
 assert.throws(() => validateDetails(input,'helpful','word',[],true), /最多包含四个/);
 input.sections.usage = [{...point, usageKind:'register'}];
 assert.throws(() => validateDetails(input,'helpful','word',[],true), /类型不受支持/);
 assert.equal(validateDetails(input,'helpful','word').sections.usage[0].usageKind, 'register');
});

test('new usage does not teach hesitation as proof that the action never happened', () => {
 const input: any = {...output(), term:'hesitate'};
 input.sections.roots = [];
 input.sections.usage = [
   {text:'Hesitate 后的动词形式', meaningZh:'Hesitate 后面通常接不定式 to do sth，表示“因犹豫而未做某事”。', usageKind:'grammar'},
   {text:'习惯用法：without hesitation', meaningZh:'这是一个非常常用的固定短语，表示“毫不犹豫地”。', usageKind:'scenario'},
   {text:'犹豫后仍可能行动', meaningZh:'hesitate to do 表示对做某事犹豫，并不意味着最终没有做。', usageKind:'grammar',
     example:'She hesitated to ask, but eventually did.'},
 ];
 assert.deepEqual(validateDetails(input,'hesitate','word',[],true).sections.usage.map(entry => entry.text), ['常见搭配限制']);
 assert.equal(validateDetails(input,'hesitate','word').sections.usage.length, 3);
});

test('usage generation accepts category and explanation without a model title', () => {
 const input = output();
 input.sections.usage = [
   {usageKind:'scenario', meaningZh:''} as typeof input.sections.usage[number],
   {usageKind:'grammar', meaningZh:'hesitate 后可接带 to 的不定式。'} as typeof input.sections.usage[number],
 ];
 const result = validateDetails(input,'helpful','word',[],true).sections.usage;
 assert.deepEqual(result.map(({usageKind,text}) => [usageKind,text]), [['grammar','常见搭配限制']]);
});
