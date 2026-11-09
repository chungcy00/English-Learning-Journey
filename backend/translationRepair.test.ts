import assert from 'node:assert/strict';
import {test} from 'node:test';
import {once} from 'node:events';
import {validateApiBody} from './requestValidation';
import app from './app';
test('sentence repair validates exact source list and mode before consuming quota',()=>{
 assert.ok(validateApiBody({sentenceOnly:true,translationSegments:[]}));
 assert.ok(validateApiBody({sentenceOnly:true,translationSegments:[42]}));
 assert.ok(validateApiBody({sentenceOnly:'true',translationSegments:['Hello.']}));
 assert.equal(validateApiBody({sentenceOnly:true,translationSegments:['Hello.']}),null);
});
test('legacy paragraph translation batches whole turns in one call',async()=>{
 const previousEnv={...process.env};const realFetch=globalThis.fetch;
 Object.assign(process.env,{UPSTASH_REDIS_REST_URL:'https://quota.example',UPSTASH_REDIS_REST_TOKEN:'test-token',AI_RATE_LIMIT_SALT:'test-salt-which-is-longer-than-32-characters',VERCEL:'0',GEMINI_API_KEY:'test-key-not-real'});
 let prompt='';let requests=0;
 globalThis.fetch=(async(url:any,options:any)=>{
  if(String(url).startsWith('https://quota.example'))return new Response(JSON.stringify({result:[1,0,0]}));
  requests++;
  const body=JSON.parse(options.body);prompt=JSON.stringify(body.contents);
  assert.deepEqual(body.generationConfig.responseSchema.required,['paragraphTranslations']);
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({paragraphTranslations:[{source:'Look at the horizon.',translation:'看看地平线。'}]})}],role:'model'},finishReason:'STOP'}]}),{headers:{'Content-Type':'application/json'}});
 }) as typeof fetch;
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const response=await realFetch(`http://127.0.0.1:${(server.address() as any).port}/api/reading/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Sarah: Look at the horizon.',readingType:'dialogue'})});
  assert.equal(response.status,200);const result=await response.json();
  assert.deepEqual(result.paragraphTranslations,[{source:'Look at the horizon.',translation:'看看地平线。'}]);
  assert.equal(result.translatedContent,undefined);assert.equal(requests,1);assert.match(prompt,/Look at the horizon/);
 }finally{globalThis.fetch=realFetch;for(const key of Object.keys(process.env))if(!(key in previousEnv))delete process.env[key];Object.assign(process.env,previousEnv);await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
