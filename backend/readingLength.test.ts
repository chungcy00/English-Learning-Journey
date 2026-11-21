import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import app from './app';
import { READING_WORD_RANGES, checkReadingLength, countEnglishWords, countReadingWords, lengthCorrectionInstruction } from './readingLength';

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ') + '.';

test('word ranges are 80-120, 150-200 and 300-400', () => {
  assert.deepEqual(READING_WORD_RANGES, { short: { min: 80, max: 120 }, medium: { min: 150, max: 200 }, long: { min: 300, max: 400 } });
});

test('counts English words: contractions and hyphenated words count once, punctuation does not', () => {
  assert.equal(countEnglishWords("I don't think it's a well-known fact — really!"), 8);
  assert.equal(countEnglishWords('  '), 0);
});

test('dialogue count excludes speaker names; plain reading counts every word', () => {
  const dialogue = 'Anna: Hello there, Tom.\nTom: Hi Anna, how are you?';
  assert.equal(countReadingWords(dialogue, true), 8);
  assert.equal(countReadingWords(dialogue, false), 10);
});

test('length check reports status and deviation honestly', () => {
  assert.equal(checkReadingLength(words(100), false, 'short').lengthStatus, 'within');
  const below = checkReadingLength(words(70), false, 'short');
  assert.deepEqual([below.lengthStatus, below.lengthDeviation], ['below', -10]);
  const above = checkReadingLength(words(330), false, 'medium');
  assert.deepEqual([above.lengthStatus, above.lengthDeviation], ['above', 130]);
  assert.equal(checkReadingLength(words(320), false, 'long').lengthStatus, 'within');
});

test('correction instruction preserves constraints and forbids padding', () => {
  const text = lengthCorrectionInstruction(checkReadingLength(words(60), false, 'short'), { title: 'T', reading: words(60), vocabulary: [{ term: 'alpha' }] }, false);
  assert.match(text, /80-120/); assert.match(text, /alpha/); assert.match(text, /Do not repeat points, add filler/);
});

async function run(lengths: number[], request: object = { input: 'topic', cefrLevel: 'B1', vocabularyCount: 1, length: 'short' }) {
  const savedEnv = { ...process.env }; const realFetch = globalThis.fetch;
  Object.assign(process.env, { GEMINI_API_KEY: 'test-key-not-real', VERCEL: '0' });
  let calls = 0; const prompts: string[] = [];
  globalThis.fetch = (async (_url: any, init: any) => {
    const n = lengths[Math.min(calls, lengths.length - 1)]; calls++;
    prompts.push(JSON.parse(init.body).contents[0].parts[0].text);
    const body = words(n);
    const out = { title: 'T', reading: body, readingType: 'story', cefrLevel: 'B1', vocabulary: [{ term: 'conflict', type: 'word', cefrLevel: 'B1', partOfSpeech: 'noun', meaningZh: '冲突', definitionEn: 'A disagreement.', example: 'x.' }], paragraphTranslations: [{ source: body, translation: '译文' }] };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }], role: 'model' }, finishReason: 'STOP' }] }), { headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const res = await realFetch(`http://127.0.0.1:${(server.address() as any).port}/api/reading/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    return { status: res.status, body: await res.json(), calls, prompts };
  } finally { globalThis.fetch = realFetch; for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k]; Object.assign(process.env, savedEnv); await new Promise<void>(r => server.close(() => r())); }
}

test('in-range result needs one call, states the target in the prompt and is marked within', async () => {
  const r = await run([100]);
  assert.equal(r.calls, 1); assert.match(r.prompts[0], /80-120 words/);
  assert.equal(r.body.wordCount, 100); assert.equal(r.body.lengthStatus, 'within'); assert.equal(r.body.lengthCorrected, false);
});

test('out-of-range result gets exactly one correction and is accepted when within range', async () => {
  const r = await run([60, 100]);
  assert.equal(r.calls, 2); assert.match(r.prompts[1], /LENGTH CORRECTION/);
  assert.equal(r.body.wordCount, 100); assert.equal(r.body.lengthStatus, 'within'); assert.equal(r.body.lengthCorrected, true);
});

test('failed correction keeps the usable result and records the deviation without retrying again', async () => {
  const r = await run([60, 60, 60]);
  assert.equal(r.calls, 2); assert.equal(r.status, 200);
  assert.equal(r.body.lengthStatus, 'below'); assert.equal(r.body.lengthDeviation, -20); assert.equal(r.body.lengthCorrected, false);
});

test('a correction that is worse is discarded; a closer-but-still-short one is kept and flagged', async () => {
  assert.equal((await run([60, 30])).body.wordCount, 60);
  const closer = await run([60, 75]);
  assert.equal(closer.body.wordCount, 75); assert.equal(closer.body.lengthStatus, 'below'); assert.equal(closer.body.lengthCorrected, true);
});
