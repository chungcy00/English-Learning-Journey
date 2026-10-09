import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import app from './app';
import { validateApiBody } from './requestValidation';

test('rejects oversized, deeply nested and prototype-key input before invoking AI', () => {
  assert.ok(validateApiBody({ input: 'x'.repeat(30001) }));
  assert.ok(validateApiBody({ vocabulary: Array(101).fill({}) }));
  assert.ok(validateApiBody(JSON.parse('{"__proto__":{"admin":true}}')));
  assert.ok(validateApiBody({ term: {} }));
  assert.ok(validateApiBody({ vocabulary: 'not an array' }));
  assert.equal(validateApiBody({ input: 'Rainy day', cefrLevel: 'B1', vocabularyCount: 8, targetLanguage: 'zh-CN' }), null);
  assert.ok(validateApiBody({ text: 'Rainy day', targetLanguage: 'ja' }));
  assert.equal(validateApiBody({ text: 'Rainy day' }), null);
  for (const readingStyle of ['auto', 'natural', 'funny', 'warm', 'suspenseful', 'dramatic', 'professional', 'cinematic']) {
    assert.equal(validateApiBody({ input: 'Rainy day', readingStyle }), null);
  }
  assert.ok(validateApiBody({ input: 'Rainy day', readingStyle: 'unrecognized' }));
});

test('API returns safe JSON for malformed and oversized bodies, not a stack trace', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/vocabulary/explain`;
  try {
    for (const [body, status] of [['{', 400], [JSON.stringify({ term: 123 }), 400], [JSON.stringify({ term: 'x'.repeat(300000) }), 413]] as const) {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      assert.equal(response.status, status);
      const result = await response.json();
      assert.equal(typeof result.error, 'string');
      assert.equal(result.stack, undefined);
      assert.equal(response.headers.get('x-powered-by'), null);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
