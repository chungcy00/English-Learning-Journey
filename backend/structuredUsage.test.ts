import assert from 'node:assert/strict';
import test from 'node:test';
import {parseGeneratedUsage,structuredUsageSchema} from './structuredUsage';
const pair={english:'They joined the discussion.',chinese:'他们加入了讨论。'};
test('each usage category produces its dedicated versioned structure with paired examples',()=>{
 const outputs=[
 {kind:'scenario',scenario:{name:'团队讨论',explanation:'用于描述主动参与讨论。',examples:[pair,pair]}},
 {kind:'grammar',grammar:{name:'interfere with',explanation:'表示妨碍某个过程，后接受影响的事物。',correct:'interfere with something',examples:[pair]}},
 {kind:'comparison',comparison:{context:'参与事务',difference:'参与和干涉的态度不同。',expressions:[{expression:'join',meaning:'加入',emphasis:'强调成为一员。',examples:[pair]},{expression:'interfere',meaning:'干涉',emphasis:'强调插手。',examples:[]}]}},
 {kind:'error',error:{name:'介词缺失',severity:'incorrect',incorrect:'interfere the process',correct:'interfere with the process',reason:'表示妨碍时需要 with。',examples:[pair]}},
 ];
 for(const output of outputs){const result=parseGeneratedUsage(output);assert.equal(result.usage?.version,2);assert.equal(result.usage?.kind,output.kind);assert.equal(result.meaningZh,'')}
 assert.notEqual(parseGeneratedUsage(outputs[0]).usage?.scenario?.examples[0].id,parseGeneratedUsage(outputs[0]).usage?.scenario?.examples[1].id);
});
test('generation rejects mixed categories, unpaired sentences, invalid contrast and excessive arrays',()=>{
 assert.throws(()=>parseGeneratedUsage({kind:'scenario',scenario:{name:'场景',explanation:'说明。',examples:[]},grammar:{}}));
 assert.throws(()=>parseGeneratedUsage({kind:'scenario',scenario:{name:'场景',explanation:'说明。',examples:[{english:'A sentence.'}]}}));
 assert.throws(()=>parseGeneratedUsage({kind:'comparison',comparison:{context:'语境',difference:'区别',expressions:[]}}));
 assert.throws(()=>parseGeneratedUsage({kind:'scenario',scenario:{name:'场景',explanation:'说明。',examples:Array(9).fill(pair)}}));
});
test('provider schema leaves array bounds to runtime validation to avoid nested constraint explosion',()=>{
 const schema=JSON.stringify(structuredUsageSchema);assert.doesNotMatch(schema,/maxItems|minItems/);
 assert.match(schema,/english/);assert.match(schema,/chinese/);
});
