import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import app from './app';
import { validateDetails } from './learningSchemas';
import { DETAILS } from './testLearningFixtures';

test('new reading and paragraph translations share one provider call; vocabulary details share one call', async () => {
  const savedEnv = { ...process.env }; const realFetch = globalThis.fetch;
  Object.assign(process.env, { GEMINI_API_KEY: 'test-key-not-real', VERCEL: '0' });
  let calls = 0, scenario = 'reading';
  globalThis.fetch = (async (url: any, init: any) => {
    calls++; const request = JSON.parse(init.body);
    if (scenario === 'budget' && calls === 1) return new Response('{"error":{"message":"UNAVAILABLE","code":503,"status":"UNAVAILABLE"}}', { status: 503 });
    const reading = { title: 'A Conflict', reading: 'We resolve a conflict. We listen.', readingType: 'story', cefrLevel: 'B1', vocabulary: [{ term: 'conflict', type: 'word', cefrLevel: 'B1', partOfSpeech: 'noun', meaningZh: '冲突', definitionEn: 'A disagreement.', example: 'We resolve a conflict.' }], paragraphTranslations: [{ source: 'We resolve a conflict. We listen.', translation: '我们解决冲突。我们倾听。' }] };
    if (scenario === 'reading') {
      assert.ok(request.generationConfig.responseSchema.required.includes('paragraphTranslations'));
      assert.ok(!request.generationConfig.responseSchema.properties.rewritePractice);
    }
    const output = scenario === 'details' ? DETAILS : scenario === 'budget' ? { ...reading, paragraphTranslations: [] } : reading;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }], role: 'model' }, finishReason: 'STOP' }] }), { headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const post = (path: string, body: object) => realFetch(`http://127.0.0.1:${(server.address() as any).port}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const reading = await post('reading/generate', { input: 'Resolving conflict', cefrLevel: 'B1', vocabularyCount: 1 });
    assert.equal(reading.status, 200); const result = await reading.json(); assert.equal(result.paragraphTranslations.length, 1); assert.equal(result.rewritePractice, undefined); assert.equal(calls, 1);
    scenario = 'details'; calls = 0;
    const word = await post('vocabulary/explain', { term: 'conflict', entryType: 'word' }); assert.equal(word.status, 200);
    const details = await word.json(); assert.equal(Object.keys(details.sections).length, 6); assert.equal(details.sections.roots.length, 0); assert.equal(calls, 1);
    scenario = 'budget'; calls = 0;
    const limited = await post('reading/generate', { input: 'Resolving conflict', cefrLevel: 'B1', vocabularyCount: 1 });
    assert.equal(limited.status, 502); assert.equal(calls, 2);
  } finally { globalThis.fetch = realFetch; for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]; Object.assign(process.env, savedEnv); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('incomplete lexical sections are rejected and phrases never receive word inflections', () => {
  assert.throws(() => validateDetails({ ...DETAILS, sections: {} }, 'conflict', 'word'));
  assert.throws(() => validateDetails({ ...DETAILS, isValidTerm: false }, 'conflict', 'word'));
  assert.equal(validateDetails({ ...DETAILS, category: 'phrase' }, 'conflict', 'phrase').inflections.length, 0);
});

test('section generation preserves referenced persistent sense IDs from the request', () => {
  const senses = [{ id: 'noun-sense', text: 'disagreement', meaningZh: '冲突', partOfSpeech: 'noun' }, { id: 'verb-sense', text: 'be incompatible', meaningZh: '相矛盾', partOfSpeech: 'verb' }];
  const output = { ...DETAILS, senses: senses.map(sense => ({ ...sense, senseId: sense.id })), sections: { ...DETAILS.sections, examples: [{ text: 'Their schedules conflict.', meaningZh: '日程相冲突。', senseId: 'verb-sense' }] } };
  const result = validateDetails(output, 'conflict', 'word', senses);
  assert.equal(result.senses[1].id, 'verb-sense'); assert.equal(result.sections.examples[0].senseId, 'verb-sense');
});

test('the same details result classifies expressions without a separate classification request', () => {
  for (const category of ['phrase','idiom','collocation','phrasal-verb'] as const) {
    const term = category === 'idiom' ? 'break the ice' : category === 'collocation' ? 'make a decision' : category === 'phrasal-verb' ? 'give up' : 'in the room';
    const result = validateDetails({ ...DETAILS, term, category }, term, 'phrase');
    assert.equal(result.category, category); assert.equal(result.type, category === 'idiom' ? 'idiom' : 'phrase');
    assert.deepEqual(result.inflections, []);
  }
});
