import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AiDeadlineError,withAiDeadline} from './aiDeadline';
test('translation deadline stops waiting even when a provider never settles and signals abort',async()=>{
 let signal:AbortSignal|undefined;
 await assert.rejects(withAiDeadline(15,async value=>{signal=value;return new Promise(()=>{});}),AiDeadlineError);
 assert.equal(signal?.aborted,true);
});
test('completed work returns normally and expired budgets start no further attempt',async()=>{
 assert.equal(await withAiDeadline(100,async()=>42),42);
 let calls=0;
 await assert.rejects(withAiDeadline(0,async()=>{calls++;}),AiDeadlineError);
 assert.equal(calls,0);
});
