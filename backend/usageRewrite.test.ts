import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseUsageRewriteJobs,validateUsageRewriteResults} from './usageRewrite';
const jobs=parseUsageRewriteJobs([{id:'one',term:'rooted',entry:{text:'rooted vs ingrained',meaningZh:'用法辨析',note:'A long English explanatory paragraph goes here.',example:'Her fear is rooted in the past.'}}]);
test('usage rewrite contract accepts Chinese explanatory fields only, with complete one-to-one IDs',()=>{
 const valid=[{id:'one',text:'用法区别',meaningZh:'说明 rooted 与 ingrained 在使用上的区别。',note:'',exampleTranslation:''}];assert.equal(validateUsageRewriteResults(valid,jobs).length,1);assert.throws(()=>validateUsageRewriteResults([],jobs));assert.throws(()=>validateUsageRewriteResults([{...valid[0],meaningZh:'This is still a long English explanation.'}],jobs));assert.throws(()=>validateUsageRewriteResults([{...valid[0],id:'wrong'}],jobs));
});
test('migration input is bounded and cannot smuggle other writable record fields',()=>{
 assert.throws(()=>parseUsageRewriteJobs([]));assert.throws(()=>parseUsageRewriteJobs(Array(31).fill(jobs[0])));assert.throws(()=>parseUsageRewriteJobs([{...jobs[0],entry:{text:'x',meaningZh:'y',note:{bad:true}}}]));const parsed=parseUsageRewriteJobs([{...jobs[0],entry:{...jobs[0].entry,provenance:{source:'user'},reviewCount:999}}]);assert.ok(!('reviewCount' in parsed[0].entry));
});
