import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateReadingWithPipeline } from '../services/api';

test('generation transport errors probe health once without replaying AI; platform timeout remains actionable', async () => {
  const realFetch = globalThis.fetch; const calls: string[] = [];
  const params = { input:'A kind visit',cefrLevel:'B1',readingType:'story',readingStyle:'auto',length:'short',vocabularyCount:1 } as const;
  try {
    globalThis.fetch = (async (url) => {
      calls.push(String(url));
      if (url === '/api/health') return new Response('{"status":"ok"}');
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await assert.rejects(generateReadingWithPipeline(params), /短文生成连接失败.*输入和已有短文会保留/);
    assert.deepEqual(calls,['/api/reading/generate','/api/health']);
    globalThis.fetch = (async () => new Response('Gateway timeout',{status:504})) as typeof fetch;
    await assert.rejects(generateReadingWithPipeline(params), /短文生成超时/);
    globalThis.fetch = (async () => new Response('{"error":"今日额度已用完"}',{status:429})) as typeof fetch;
    await assert.rejects(generateReadingWithPipeline(params), /今日额度已用完/);
  } finally { globalThis.fetch = realFetch; }
});
