import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { readGenerationDraft, saveGenerationDraft } from './generationDraft';
import { filterSavedVocabulary } from './savedVocabulary';
import type { VocabularyItem } from '../types';

test('legacy migration waits for closed clients and never forces activation or navigation', async () => {
  const listeners = new Map<string, (event: { waitUntil: (promise: Promise<void>) => void }) => void>();
  let unregistered = false;
  runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), { self: {
    addEventListener: (type: string, callback: typeof listeners extends Map<string, infer T> ? T : never) => listeners.set(type, callback),
    registration: { unregister: async () => { unregistered = true; } },
    skipWaiting: () => assert.fail('must not force activation'),
    clients: { matchAll: () => assert.fail('must not navigate open clients') },
  } });
  assert.equal(listeners.has('install'), false);
  let completion: Promise<void> | undefined;
  listeners.get('activate')!({ waitUntil: promise => { completion = promise; } });
  await completion;
  assert.equal(unregistered, true);
});

test('per-session draft restores phrases and clears without blocking on storage denial', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage: {
      getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key),
    } } });
    saveGenerationDraft('雨天, break the ice；catch up');
    assert.equal(readGenerationDraft(), '雨天, break the ice；catch up');
    saveGenerationDraft('');
    assert.equal(readGenerationDraft(), '');
    Object.defineProperty(globalThis, 'window', { configurable: true, get: () => { throw new Error('storage denied'); } });
    assert.equal(readGenerationDraft(), '');
    assert.doesNotThrow(() => saveGenerationDraft('hello'));
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('collection filters all saved levels and future-due expressions without mutating input', () => {
  const items = [{ term: 'help out', cefrLevel: 'B1', status: 'New' }, { term: 'break the ice', cefrLevel: 'B2', status: 'Learning', nextReviewDate: Date.now() + 86400000 }] as VocabularyItem[];
  assert.equal(filterSavedVocabulary(items, '', 'All').length, 2);
  assert.deepEqual(filterSavedVocabulary(items, 'break', 'All').map(item => item.term), ['break the ice']);
  assert.equal(filterSavedVocabulary(items, 'BREAK THE ICE', 'Learning').length, 1);
  assert.equal(filterSavedVocabulary(items, 'break', 'New').length, 0);
  assert.deepEqual(items.map(item => item.term), ['help out', 'break the ice']);
});
