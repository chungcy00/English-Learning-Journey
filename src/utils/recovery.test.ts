import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readReviewProgress, writeReviewProgress, restoreReviewProgress } from './reviewProgress';
import { generateReadingWithPipeline, rewriteReadingWithPipeline } from '../services/api';
import type { GenerationRequest, RewriteReadingRequest } from '../types';

test('review progress restores by ID, tolerates removed items and invalid or denied storage', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  let stored = '';
  try {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
      getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; },
    } });
    writeReviewProgress({ currentId: 'b', revealed: true, completed: false, ids: ['a', 'b'] });
    assert.deepEqual(restoreReviewProgress(['b', 'a'], readReviewProgress()), { index: 0, revealed: true, completed: false });
    assert.deepEqual(restoreReviewProgress(['a'], readReviewProgress()), { index: 0, revealed: false, completed: false });
    stored = '{}';
    assert.equal(readReviewProgress(), null);
    stored = '{broken';
    assert.equal(readReviewProgress(), null);
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: () => { throw new Error('denied'); } });
    assert.equal(readReviewProgress(), null);
    assert.doesNotThrow(() => writeReviewProgress({ currentId: 'a', revealed: false, completed: false, ids: ['a'] }));
  } finally {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});

test('completed session does not hide newly added vocabulary', () => {
  assert.equal(restoreReviewProgress(['a', 'b'], { currentId: 'a', revealed: false, completed: true, ids: ['a'] }).completed, false);
});

test('generation and rewrite reject cancellation, including a late response from a transport ignoring abort', async () => {
  const original = globalThis.fetch;
  try {
    for (const run of [
      (signal: AbortSignal) => generateReadingWithPipeline({ input: 'rain', cefrLevel: 'B1', vocabularyCount: 5 } as GenerationRequest, undefined, signal),
      (signal: AbortSignal) => rewriteReadingWithPipeline({ readingId: 'a' } as RewriteReadingRequest, undefined, signal),
    ]) {
      const controller = new AbortController();
      globalThis.fetch = async (_url, options) => {
        assert.equal(options?.signal, controller.signal);
        controller.abort();
        return new Response(JSON.stringify({ vocabulary: [], rewritePractice: [] }));
      };
      await assert.rejects(run(controller.signal), { name: 'AbortError' });
      globalThis.fetch = async () => { assert.fail('already canceled must not send a request'); };
      await assert.rejects(run(controller.signal), { name: 'AbortError' });
    }
  } finally { globalThis.fetch = original; }
});
