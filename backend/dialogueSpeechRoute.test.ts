import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import app from './app';

test('dialogue endpoint requests default audio and serves PCM as WAV in a single quota reservation', async () => {
  const savedEnv = { ...process.env };
  Object.assign(process.env, {
    UPSTASH_REDIS_REST_URL: 'https://quota.example',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
    AI_RATE_LIMIT_SALT: 'test-salt-which-is-longer-than-32-characters',
    GEMINI_API_KEY: 'test-key-not-real', VERCEL: '0',
  });
  const realFetch = globalThis.fetch;
  const pcm = Buffer.from([0, 0, 255, 127]);
  let reservations = 0;
  let requests = 0;
  globalThis.fetch = (async (input: any, options: any) => {
    const request = input instanceof Request ? input : new Request(input, options);
    if (request.url.startsWith('https://quota.example')) {
      reservations++;
      return new Response('{"result":[1,0,0]}');
    }
    assert.match(request.url, /^https:\/\/generativelanguage.googleapis.com\/v1beta\/interactions/);
    requests++;
    const body = await request.json();
    assert.deepEqual(body.response_format, { type: 'audio' });
    assert.equal(body.generation_config.speech_config.length, 2);
    return new Response(JSON.stringify({
      id: 'test-interaction', status: 'completed', model: 'gemini-3.1-flash-tts-preview',
      steps: [{ type: 'model_output', content: [{ type: 'audio', data: pcm.toString('base64'), mime_type: 'audio/l16;rate=24000' }] }],
    }), { headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const port = (server.address() as { port: number }).port;
    const response = await realFetch(`http://127.0.0.1:${port}/api/speech/dialogue`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns: [{ text: 'Hello.', gender: 'female' }, { text: 'Hi.', gender: 'male' }] }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get('content-type')!, /audio\/wav/);
    const wav = Buffer.from(await response.arrayBuffer());
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.deepEqual(wav.subarray(44), pcm);
    assert.equal(reservations, 1);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = realFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
