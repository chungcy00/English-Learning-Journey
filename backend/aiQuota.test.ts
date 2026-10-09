import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { AiQuotaError, clientIp, normalizeIp, reserveQuota, QUOTA_SCRIPT } from './aiQuota';
import app from './app';

const env = { UPSTASH_REDIS_REST_URL: 'https://quota.example', UPSTASH_REDIS_REST_TOKEN: 'test-token', AI_RATE_LIMIT_SALT: 'test-salt-which-is-longer-than-32-characters' };
const result = (value: unknown) => (async () => new Response(JSON.stringify(value))) as typeof fetch;

test('normalizes IPv4, mapped IPv6 and IPv6 /64; untrusted forwarding headers do not change local IP', () => {
  assert.equal(normalizeIp('::ffff:192.0.2.1'), '192.0.2.1');
  assert.equal(normalizeIp('::ffff:c000:201'), '192.0.2.1');
  assert.equal(normalizeIp('2001:db8::1'), normalizeIp('2001:0db8:0000:0000::abcd'));
  assert.notEqual(normalizeIp('2001:db8:1::1'), normalizeIp('2001:db8:2::1'));
  const request = { headers: { 'x-forwarded-for': '192.0.2.2' }, socket: { remoteAddress: '192.0.2.1' } } as any;
  assert.equal(clientIp(request, {}), '192.0.2.1');
  assert.equal(clientIp(request, { VERCEL: '1' }), '192.0.2.2');
  assert.throws(() => clientIp({ headers: {}, socket: {} } as any, { VERCEL: '1' }));
  assert.throws(() => normalizeIp('not-an-ip'));
});

test('all limits are reserved in one atomic request without storing the raw IP', async () => {
  const commands: any[] = [];
  const store = (async (_url, options) => {
    commands.push(JSON.parse(String(options?.body)));
    return new Response('{"result":[1,0,0]}');
  }) as typeof fetch;
  await reserveQuota('192.0.2.1', 'text', env, store);
  await reserveQuota('192.0.2.1', 'speech', env, store);
  assert.equal(commands[0][0], 'EVAL');
  assert.equal(commands[0][1], QUOTA_SCRIPT);
  assert.equal(commands[0][2], 3);
  assert.equal(commands[1][2], 5);
  assert.deepEqual(commands[1].slice(3, 6), commands[0].slice(3, 6));
  assert.equal(JSON.stringify(commands).includes('192.0.2.1'), false);
  assert.deepEqual(commands[0].slice(6), [100, 86400, 5, 60, 30, 86400]);
});

test('quota denials return 429 and reset time; unavailable/config-invalid storage fails closed', async () => {
  await assert.rejects(reserveQuota('192.0.2.1', 'text', env, result({ result: [0, 1, 345] })),
    (error: AiQuotaError) => error.status === 429 && error.retryAfter === 345 && error.message.includes('全站'));
  for (const response of [{ error: 'test' }, { result: [] }, { result: [0, 9, 60] }, { result: [1, 1, 1] }]) {
    await assert.rejects(reserveQuota('192.0.2.1', 'text', env, result(response)), (error: AiQuotaError) => error.status === 503);
  }
  for (const config of [{}, { ...env, AI_IP_DAILY_LIMIT: '-1' }, { ...env, AI_RATE_LIMIT_SALT: '' }]) {
    await assert.rejects(reserveQuota('192.0.2.1', 'text', config, result({ result: [1, 0, 0] })), (error: AiQuotaError) => error.status === 503);
  }
  await assert.rejects(reserveQuota('192.0.2.1', 'text', env, (async () => { throw Error('network secret'); }) as typeof fetch),
    (error: AiQuotaError) => error.status === 503 && !error.message.includes('secret'));
});

test('every AI endpoint refuses exhausted global quota before any provider request', async () => {
  const savedEnv = { ...process.env };
  Object.assign(process.env, env, { VERCEL: '0' });
  const realFetch = globalThis.fetch;
  let providerCalls = 0;
  let reservations = 0;
  globalThis.fetch = (async (url: any, _options: any) => {
    if (String(url).startsWith(env.UPSTASH_REDIS_REST_URL)) {
      reservations++;
      return new Response('{"result":[0,1,120]}');
    }
    if (String(url).startsWith('http://127.0.0.1:')) return realFetch(url, _options);
    providerCalls++;
    throw Error('Unexpected external request');
  }) as typeof fetch;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const requests = [
    ['reading/generate', { input: 'Rainy day' }],
    ['reading/rewrite', { reading: 'A rainy day.', mode: 'shorter' }],
    ['reading/translate', { text: 'A rainy day.', targetLanguage: 'zh-CN' }],
    ['rewrite/evaluate', { userAnswer: 'Good morning.', target: 'morning' }],
    ['vocabulary/explain', { term: 'break the ice' }],
    ['vocabulary/candidates', { contextReading: 'We helped her out.' }],
    ['speech/dialogue', { turns: [{ text: 'Hello.', gender: 'female' }] }],
  ] as const;
  try {
    for (const [route, body] of requests) {
      const response = await realFetch(`http://127.0.0.1:${port}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 429, route);
      assert.equal(response.headers.get('retry-after'), '120', route);
      assert.equal((await response.json()).code, 'AI_QUOTA_EXCEEDED', route);
    }
    assert.equal(reservations, requests.length);
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = realFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('provider fallback must reserve again and stops immediately at the global cap', async () => {
  const savedEnv = { ...process.env };
  Object.assign(process.env, env, { VERCEL: '0', GEMINI_API_KEY: 'test-key-not-real' });
  const realFetch = globalThis.fetch;
  let reservations = 0;
  let providerCalls = 0;
  globalThis.fetch = (async (url: any) => {
    if (String(url).startsWith(env.UPSTASH_REDIS_REST_URL)) {
      reservations++;
      return new Response(JSON.stringify({ result: reservations === 1 ? [1, 0, 0] : [0, 1, 120] }));
    }
    providerCalls++;
    return new Response(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'Test transient error' } }), { status: 503 });
  }) as typeof fetch;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await realFetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/vocabulary/explain`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term: 'genuine' }),
    });
    assert.equal(response.status, 429);
    assert.equal(reservations, 2);
    assert.equal(providerCalls, 1, 'SDK retries must not make uncounted calls');
  } finally {
    globalThis.fetch = realFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
