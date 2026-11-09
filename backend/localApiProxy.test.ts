import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { once } from 'node:events';
import { localApiProxy } from './localApiProxy';

test('development proxy sends only learning data and preserves production quota rejection', async () => {
  let calls = 0;
  const proxy = localApiProxy({ LOCAL_AI_API_ORIGIN: 'https://existing.example' }, (async (url: any, init: any) => {
    calls++; assert.equal(String(url), 'https://existing.example/api/vocabulary/explain');
    assert.deepEqual(init.headers, { 'Content-Type': 'application/json', Accept: 'application/json' });
    assert.deepEqual(JSON.parse(init.body), { term: 'rooted' });
    return new Response('{"code":"GENERATION_PROVIDER_LIMIT","error":"limit reached"}', { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } });
  }) as typeof fetch)!;
  const app = express(); app.use(express.json()); app.use(proxy); app.use((_req,res)=>res.sendStatus(410));
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const response = await fetch(`${base}/api/vocabulary/explain`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization:'Bearer do-not-forward', 'X-Forwarded-For':'spoofed' }, body:'{"term":"rooted"}' });
    assert.equal(response.status,429); assert.equal(response.headers.get('retry-after'),'60'); assert.equal((await response.json()).code,'GENERATION_PROVIDER_LIMIT'); assert.equal(calls,1);
    assert.equal((await fetch(`${base}/api/reading/rewrite`,{method:'POST'})).status,410);assert.equal(calls,1);
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
test('proxy cannot run in production or accept credentials and arbitrary paths', () => {
  assert.equal(localApiProxy({ NODE_ENV:'production', LOCAL_AI_API_ORIGIN:'https://existing.example' }),null);
  assert.equal(localApiProxy({}),null);
  for(const origin of ['http://existing.example','https://user:secret@existing.example','https://existing.example/api','https://existing.example/?key=value'])assert.throws(()=>localApiProxy({LOCAL_AI_API_ORIGIN:origin}));
});
