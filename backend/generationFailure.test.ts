import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { AiDeadlineError } from './aiDeadline';
import { GenerationContractError, generationFailure } from './generationFailure';
import app from './app';

test('generation failures distinguish timeout, upstream limits, configuration and invalid results without leaking provider details', () => {
  const cases = [
    [new AiDeadlineError(), 504, 'GENERATION_TIMEOUT'],
    [new Error('GEMINI_API_KEY secret=test-secret'), 503, 'GENERATION_NOT_CONFIGURED'],
    [{status:429, message:'secret=test-secret'}, 429, 'GENERATION_PROVIDER_LIMIT'],
    [{status:503, message:'secret=test-secret'}, 503, 'GENERATION_BUSY'],
    [new SyntaxError('secret=test-secret'), 502, 'GENERATION_INVALID_RESULT'],
    [new GenerationContractError(), 502, 'GENERATION_INVALID_RESULT'],
    [new TypeError('fetch failed secret=test-secret'), 502, 'GENERATION_CONNECTION_FAILED'],
    [new Error('secret=test-secret'), 500, 'GENERATION_FAILED'],
  ] as const;
  for (const [error, status, code] of cases) {
    const result = generationFailure(error);
    assert.equal(result.status, status); assert.equal(result.code, code);
    assert.doesNotMatch(result.error, /test-secret|翻译/);
  }
});

test('generation repairs malformed JSON, rejects incomplete results and shares one deadline across policy retries', async () => {
  const env = {...process.env}; const realFetch = globalThis.fetch; const realNow = Date.now;
  Object.assign(process.env,{VERCEL:'0',GEMINI_API_KEY:'test-key-not-real'});
  const good = {title:'A kind visit', reading:'A considerate friend came to visit.', cefrLevel:'B1', readingType:'story', vocabulary:[{term:'considerate',type:'word',cefrLevel:'B1',meaningZh:'体贴的',definitionEn:'Thoughtful.',example:'She is considerate.',partOfSpeech:'adjective'}],paragraphTranslations:[{source:'A considerate friend came to visit.',translation:'一位体贴的朋友来访。'}]};
  let mode = 'repair'; let calls = 0; let now = realNow();
  globalThis.fetch = (async (url: any) => {
    calls++;
    if (mode === 'deadline') now += 46000;
    const output = mode === 'repair' && calls === 1 ? '{broken' : JSON.stringify(mode === 'repair' ? good : {...good,vocabulary:[]});
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:output}],role:'model'},finishReason:'STOP'}]}), {headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
  const request = () => realFetch(`http://127.0.0.1:${(server.address() as any).port}/api/reading/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:'A kind visit',cefrLevel:'B1',vocabularyCount:1})});
  try {
    let response = await request(); assert.equal(response.status,200); assert.equal(calls,2);
    assert.equal((await response.json()).title,good.title);
    mode = 'invalid'; calls = 0;
    response = await request(); assert.equal(response.status,502); assert.equal(calls,2);
    assert.equal((await response.json()).code,'GENERATION_INVALID_RESULT');
    mode = 'deadline'; calls = 0; Date.now = () => now;
    response = await request(); assert.equal(response.status,504); assert.equal(calls,1);
    assert.equal((await response.json()).code,'GENERATION_TIMEOUT');
  } finally {
    Date.now = realNow; globalThis.fetch = realFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env,env);
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
