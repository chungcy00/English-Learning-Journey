import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeView } from '../views/HomeView';
import { generateReadingWithPipeline } from '../services/api';
import type { AppSettings, ReadingRecord } from '../types';

const settings = { cefr: 'B2', defaultReadingType: 'dialogue', defaultReadingStyle: 'warm', defaultLength: 'long', vocabularyCount: 10 } as AppSettings;
const render = (isLoading = false) => renderToStaticMarkup(React.createElement(HomeView, { settings, onGenerate: () => {}, isLoading }));

test('home starts with the confirmed expanded recipe and saved parameters', () => {
  const html = render();
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /id="recipe-panel"/); assert.match(html, /id="reading-style"/);
  for (const text of ['B2', '对话', '长篇', '>10</output>', 'Warm（温暖治愈）']) assert.ok(html.includes(text));
  for (const text of ['寻找创作灵感', '创作你的短文', '学习配方', '生成专属短文']) assert.ok(html.includes(text));
  assert.match(html, /<label for="generation-input"/);
  assert.doesNotMatch(html, /Language Studio|YOUR ENGLISH SPACE|每一个想法|都能成为一篇故事|选择一个场景|studio-summary/);
});

test('inspiration provides four scenes and three local themes without duplicate controls', () => {
  const html = render();
  const scenes = html.match(/<div class="studio-scenes"[\s\S]*?<\/div>/)![0];
  assert.equal((scenes.match(/<button/g) || []).length, 4);
  const topics = html.match(/<div class="studio-topics"[\s\S]*?<\/div>/)![0];
  assert.equal((topics.match(/<button/g) || []).length, 3);
  assert.ok(topics.includes('如何礼貌地拒绝别人'));
  assert.equal((topics.match(/lucide-arrow-right/g) || []).length, 3);
});

test('continue reading uses real article data and omits unsupported progress', () => {
  assert.doesNotMatch(render(), /CONTINUE READING/);
  const currentReading = { title: 'A real saved passage', cefrLevel: 'B1', readingType: 'dialogue' } as ReadingRecord;
  const html = renderToStaticMarkup(React.createElement(HomeView, { settings, onGenerate: () => {}, isLoading: false, currentReading, onContinueReading: () => {} }));
  assert.ok(html.includes('A real saved passage'));
  assert.ok(html.includes('B1 · 对话'));
  assert.doesNotMatch(html, /60%|role="progressbar"/);
  assert.ok(html.indexOf('CONTINUE READING') < html.indexOf('inspiration-title'));
});

test('empty input and loading prevent generation, preserving the existing flow', () => {
  assert.match(render(), /type="submit" class="studio-generate" disabled=""/);
  const html = render(true);
  assert.match(html, /生成中…/);
  assert.match(html, /id="generation-input"[^>]*disabled=""/);
});

test('custom style is sent through the existing API input without changing stored topic or preset enums', async () => {
  const originalFetch = globalThis.fetch;
  let body: any;
  globalThis.fetch = (async (url, init) => {
    assert.equal(url, '/api/reading/generate');
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ title: 'Example', reading: 'A short scene.', vocabulary: [], rewritePractice: [] }), { status: 200 });
  }) as typeof fetch;
  try {
    const record = await generateReadingWithPipeline({ input: '雨天', cefrLevel: 'B1', readingType: 'story', readingStyle: 'auto', customReadingStyle: '温暖的赛博朋克风', length: 'medium', vocabularyCount: 8, specifiedVocabulary: ['genuine'] });
    assert.ok(body.input.includes('雨天'));
    assert.ok(body.input.includes('温暖的赛博朋克风'));
    assert.equal(body.readingStyle, 'auto');
    assert.equal(body.customReadingStyle, undefined);
    assert.deepEqual(body.specifiedVocabulary, ['genuine']);
    assert.equal(record.input, '雨天');
    assert.equal(record.topic, '雨天');
    await generateReadingWithPipeline({ input: 'Morning', cefrLevel: 'B1', readingType: 'dialogue', readingStyle: 'cinematic', length: 'short', vocabularyCount: 1 });
    assert.equal(body.input, 'Morning');
    assert.equal(body.readingStyle, 'cinematic');
  } finally { globalThis.fetch = originalFetch; }
});

test('imported transcript travels separately from topic and keeps linked vocabulary at A1/C2', async () => {
  const realFetch = globalThis.fetch;
  const sourceText = 'We learn by trying, making mistakes, and trying again.';
  globalThis.fetch = (async (_url, init) => {
    const body=JSON.parse(String(init?.body));
    assert.equal(body.sourceText,sourceText);assert.equal(body.specifiedVocabulary,undefined);
    return new Response(JSON.stringify({title:'Keep Trying',reading:'We try again.',cefrLevel:body.cefrLevel,vocabulary:[{term:'try',cefrLevel:body.cefrLevel}],rewritePractice:[]}));
  }) as typeof fetch;
  try {
    for (const cefrLevel of ['A1','C2'] as const) {
      const record=await generateReadingWithPipeline({input:'Learning from mistakes',sourceText,cefrLevel,readingType:'non-story',length:'short',vocabularyCount:1});
      assert.equal(record.sourceText,sourceText);assert.equal(record.topic,'Learning from mistakes');assert.equal(record.cefrLevel,cefrLevel);
      assert.equal(record.selectedVocabulary[0].sourceReadingId,record.id);
      assert.equal(record.selectedVocabulary[0].sourceCefrLevel,cefrLevel);
    }
  } finally { globalThis.fetch=realFetch; }
});
