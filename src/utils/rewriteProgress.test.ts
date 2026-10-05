import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRewriteProgressStore, rewriteProgressKey } from './rewriteProgress';
import type { RewriteEvaluation, RewritePracticeItem } from '../types';

const item: RewritePracticeItem = { id: 'exercise-1', originalSentence: 'She became happy.', target: 'brighten up', referenceAnswer: 'She brightened up.' };
const evaluation: RewriteEvaluation = { rating: 'Good', meaningPreserved: true, targetUsedCorrectly: true, whatYouDidWell: ['自然'], issues: [], improvedVersion: 'She brightened up.', referenceAnswer: 'She brightened up.' };
function setup() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
  return { values, storage, store: createRewriteProgressStore(() => storage), key: rewriteProgressKey('reading-1', item) };
}

test('drafts restore across navigation and a fresh store, including CJK and empty answers', () => {
  const { storage, store, key } = setup();
  store.edit(key, item, 'She brightened up. 中文 🌱\nSecond line');
  assert.equal(store.get(key, item).saved, true);
  const restored = createRewriteProgressStore(() => storage);
  assert.equal(restored.get(key, item).answer, 'She brightened up. 中文 🌱\nSecond line');
  restored.edit(key, item, '');
  assert.equal(createRewriteProgressStore(() => storage).get(key, { ...item, userAnswer: 'old' }).answer, '');
});

test('progress is isolated by passage and exercise content, not just exercise ID', () => {
  const { store, key } = setup();
  store.edit(key, item, 'She brightened up.');
  assert.equal(store.get(rewriteProgressKey('reading-2', item), item).answer, '');
  const changed = { ...item, originalSentence: 'A new question.' };
  assert.equal(store.get(rewriteProgressKey('reading-1', changed), changed).answer, '');
});

test('pending task survives unsubscribe/remount, deduplicates requests, and persists feedback', async () => {
  const { storage, store, key } = setup();
  store.edit(key, item, 'She brightened up.');
  let finish!: (value: RewriteEvaluation) => void;
  let calls = 0;
  const evaluator = () => { calls++; return new Promise<RewriteEvaluation>(resolve => { finish = resolve; }); };
  const unsubscribe = store.subscribe(() => {});
  const task = store.evaluate(key, item, evaluator);
  unsubscribe();
  assert.equal(store.get(key, item).pending, true);
  assert.equal(store.needsProtection(), true);
  await store.evaluate(key, item, evaluator);
  assert.equal(calls, 1);
  finish(evaluation);
  await task;
  assert.equal(store.needsProtection(), false);
  assert.deepEqual(createRewriteProgressStore(() => storage).get(key, item).evaluation, evaluation);
});

test('errors preserve answers and allow retry; editing invalidates old feedback', async () => {
  const { store, key } = setup();
  store.edit(key, item, 'She brightened up.');
  await store.evaluate(key, item, async () => { throw new Error('网络不可用'); });
  assert.equal(store.get(key, item).error, '网络不可用');
  assert.equal(store.get(key, item).answer, 'She brightened up.');
  assert.equal(store.get(key, item).pending, false);
  await store.evaluate(key, item, async () => evaluation);
  assert.deepEqual(store.get(key, item).evaluation, evaluation);
  assert.equal(store.get(key, item).error, undefined);
  store.edit(key, item, 'Changed');
  assert.equal(store.get(key, item).evaluation, undefined);
});

test('late results never attach to an edited answer or another passage', async () => {
  const { store, key } = setup();
  store.edit(key, item, 'First answer');
  let finish!: (value: RewriteEvaluation) => void;
  const task = store.evaluate(key, item, () => new Promise(resolve => { finish = resolve; }));
  store.edit(key, item, 'Second answer');
  finish(evaluation);
  await task;
  assert.equal(store.get(key, item).answer, 'Second answer');
  assert.equal(store.get(key, item).evaluation, undefined);
  assert.equal(store.get(rewriteProgressKey('other', item), item).evaluation, undefined);
});

test('storage denial retains in-memory progress and exposes protection until retry succeeds', () => {
  const { storage, key } = setup();
  let denied = true;
  const store = createRewriteProgressStore(() => { if (denied) throw new Error('Quota exceeded'); return storage; });
  store.edit(key, item, 'Still here');
  assert.equal(store.get(key, item).answer, 'Still here');
  assert.equal(store.get(key, item).saved, false);
  assert.equal(store.needsProtection(), true);
  denied = false;
  store.retrySave(key, item);
  assert.equal(store.needsProtection(), false);
  assert.equal(createRewriteProgressStore(() => storage).get(key, item).answer, 'Still here');
});

test('corrupt stored data does not crash or restore malformed feedback', () => {
  const { values, storage, key } = setup();
  values.set(key, '{invalid');
  assert.equal(createRewriteProgressStore(() => storage).get(key, item).answer, '');
  values.set(key, JSON.stringify({ answer: 'Valid draft', evaluation: { rating: 'Good' } }));
  const progress = createRewriteProgressStore(() => storage).get(key, item);
  assert.equal(progress.answer, 'Valid draft');
  assert.equal(progress.evaluation, undefined);
});

test('practice cards subscribe to shared progress with a passage identity and save-failure affordance', () => {
  const card = readFileSync(new URL('../components/RewritePracticeCard.tsx', import.meta.url), 'utf8');
  const reading = readFileSync(new URL('../views/RewritePracticeView.tsx', import.meta.url), 'utf8');
  assert.match(card, /useSyncExternalStore/);
  assert.match(card, /rewriteProgressStore\.edit/);
  assert.match(card, /rewriteProgressStore\.evaluate/);
  assert.match(card, /retrySave/);
  assert.match(reading, /readingId=\{reading\.id\}/);
});
