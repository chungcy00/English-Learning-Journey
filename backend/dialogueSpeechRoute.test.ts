import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import app from './app';
test('retired cloud speech, rewrite, evaluation and catalogue routes perform no external work', async () => {
  const realFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('Must not call an external service'); }) as typeof fetch;
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    for (const path of ['speech/dialogue','reading/rewrite','rewrite/evaluate','vocabulary/candidates']) {
      const response = await realFetch(`http://127.0.0.1:${(server.address() as any).port}/api/${path}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
      assert.equal(response.status, 410); assert.equal(calls, 0);
    }
  } finally { globalThis.fetch = realFetch; await new Promise<void>(resolve => server.close(() => resolve())); }
});
