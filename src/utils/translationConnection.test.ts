import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translationConnectionMessage } from './translationConnection';
import { translateReading } from '../services/api';

test('connection diagnosis probes only uncached health, reporting origin and release', async () => {
  const message = await translationConnectionMessage(undefined, {
    origin: 'https://installed.example', release: 'test123',
    fetcher: (async (url, init) => {
      assert.equal(url, '/api/health'); assert.equal(init?.cache, 'no-store');
      assert.equal(init?.method, undefined);
      return new Response(JSON.stringify({ status: 'ok' }));
    }) as typeof fetch,
  });
  assert.match(message, /站点可达/); assert.match(message, /installed.example/); assert.match(message, /test123/);
});

test('unreachable, wrong and hanging health responses have bounded distinct diagnoses', async () => {
  const cases = [
    { fetcher: async () => { throw new TypeError('Failed to fetch'); }, match: /无法连接服务/ },
    { fetcher: async () => new Response('', { status: 404 }), match: /HTTP 404/ },
    { fetcher: async () => new Response('{}'), match: /未返回预期服务/ },
    { fetcher: async () => new Promise<Response>(() => {}), match: /检查超时/ },
  ];
  for (const item of cases) assert.match(await translationConnectionMessage(undefined, { fetcher: item.fetcher as typeof fetch, timeoutMs: 10 }), item.match);
});

test('translation POST network failure is diagnosed once without replaying AI; HTTP quota error remains intact', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  const params = { text: 'Look at the horizon.', title: 'Test', readingType: 'story', sentenceOnly: true, translationSegments: ['Look at the horizon.'] };
  try {
    globalThis.fetch = (async (url) => {
      calls.push(String(url));
      if (url === '/api/health') return new Response('{"status":"ok"}');
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await assert.rejects(translateReading(params), /站点可达/);
    assert.deepEqual(calls, ['/api/reading/translate', '/api/health']);
    globalThis.fetch = (async () => new Response('{"error":"今日额度已用完"}', { status: 429 })) as typeof fetch;
    await assert.rejects(translateReading(params), /今日额度已用完/);
  } finally { globalThis.fetch = original; }
});

test('cancelled connection checks stay cancelled instead of reporting a device fault', async () => {
  const controller = new AbortController();
  const check = translationConnectionMessage(controller.signal, { fetcher: (() => new Promise(() => {})) as typeof fetch });
  controller.abort();
  await assert.rejects(check, { name: 'AbortError' });
});
