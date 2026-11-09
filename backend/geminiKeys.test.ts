import {test} from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {GeminiKeyPool,configuredGeminiKeys,GeminiProviderError} from './geminiKeys';import app from './app';import {DETAILS} from './testLearningFixtures';
test('three server keys are deduplicated and rotated without Redis or user counters',()=>{
 assert.deepEqual(configuredGeminiKeys({GEMINI_API_KEY:'first',GEMINI_API_KEY_2:' second ',GEMINI_API_KEY_3:'first'}),['first','second']);
 assert.deepEqual(configuredGeminiKeys({GEMINI_API_KEY:'MY_GEMINI_API_KEY',GEMINI_API_KEY_2:'AQ.test-authorization-key'}),['AQ.test-authorization-key']);
 const pool=new GeminiKeyPool(()=>['one','two','three']);assert.deepEqual(Array.from({length:6},()=>pool.select().key),['one','two','three','one','two','three']);assert.throws(()=>new GeminiKeyPool(()=>[]).select(),e=>e instanceof GeminiProviderError&&e.status===503);
});
test('provider cooldown skips an affected key and expiry restores it; authentication failures do not masquerade as user limits',()=>{
 const pool=new GeminiKeyPool(()=>['one','two']);pool.failed('one',{status:429,retryAfter:30},1000);assert.equal(pool.select(1000).key,'two');pool.failed('two',{status:429,retryAfter:10},1000);assert.throws(()=>pool.select(2000),e=>e instanceof GeminiProviderError&&e.status===429&&e.retryAfter===9);assert.equal(pool.select(12000).key,'two');assert.equal(pool.select(32000).key,'one');
 const invalid=new GeminiKeyPool(()=>['bad']);invalid.failed('bad',{status:401},1000);assert.throws(()=>invalid.select(2000),e=>e instanceof GeminiProviderError&&e.status===401);
});
async function withServer(keys:string[],handler:(url:any,init:any)=>Promise<Response>,check:(post:()=>Promise<Response>)=>Promise<void>){
 const env={...process.env},realFetch=globalThis.fetch;
 Object.assign(process.env,{GEMINI_API_KEY:keys[0],GEMINI_API_KEY_2:keys[1]||'',GEMINI_API_KEY_3:keys[2]||''});
 globalThis.fetch=handler as typeof fetch;const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{await check(()=>realFetch(`http://127.0.0.1:${(server.address() as any).port}/api/vocabulary/explain`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({term:'conflict'})}));}
 finally{globalThis.fetch=realFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
const success=()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(DETAILS)}],role:'model'},finishReason:'STOP'}]}),{headers:{'Content-Type':'application/json'}});
test('actual SDK requests use all three keys and never contact a quota store',async()=>{
 const seen:string[]=[];await withServer(['rotation-a','rotation-b','rotation-c'],async(url,init)=>{assert.ok(String(url).includes('generativelanguage.googleapis.com'));seen.push(new Headers(init.headers).get('x-goog-api-key')!);return success();},async post=>{for(let i=0;i<3;i++)assert.equal((await post()).status,200);});assert.deepEqual(new Set(seen),new Set(['rotation-a','rotation-b','rotation-c']));
});
test('exhausted and invalid provider keys switch to the third key within the same request',async()=>{
 const seen:string[]=[];await withServer(['failover-a','failover-b','failover-c'],async(_url,init)=>{const key=new Headers(init.headers).get('x-goog-api-key')!;seen.push(key);return key==='failover-c'?success():new Response(JSON.stringify({error:{code:key==='failover-a'?429:401,status:key==='failover-a'?'RESOURCE_EXHAUSTED':'UNAUTHENTICATED',message:'Provider unavailable'}}),{status:key==='failover-a'?429:401});},async post=>{const response=await post();assert.equal(response.status,200);assert.ok(!JSON.stringify(await response.json()).includes('failover-'));});assert.equal(seen.length,3);assert.equal(seen.at(-1),'failover-c');
});
