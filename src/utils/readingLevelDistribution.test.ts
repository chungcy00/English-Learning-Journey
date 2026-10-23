import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { distributionSource, filterReadingsByLevel, readingLevelDistribution } from './readingLevelDistribution';
import { ReadingLevelPieChart } from '../components/ReadingLevelPieChart';
import { ReadingHistoryView } from '../views/ReadingHistoryView';
import type { ReadingRecord } from '../types';

test('empty readings have no invented distribution', () => {
  assert.ok(readingLevelDistribution([]).every(item => item.count === 0 && item.percentage === 0));
  const html = renderToStaticMarkup(React.createElement(ReadingLevelPieChart, { readings: [] }));
  assert.match(html, /保存短文后显示等级分布/);
  assert.match(html, /总计/);
  assert.match(html, />0 篇</);
  assert.doesNotMatch(html, /class="reading-distribution__segment"/);
});

test('single level is a full circle; missing and unsupported levels remain unknown', () => {
  const values = readingLevelDistribution([{ cefrLevel: 'B1' }, {}, { cefrLevel: 'A1' }]);
  assert.equal(values.find(item => item.level === 'B1')!.count, 1);
  assert.equal(values.find(item => item.level === '未知')!.count, 1);
  assert.equal(values.find(item => item.level === 'A1')!.count, 1);
  const html = renderToStaticMarkup(React.createElement(ReadingLevelPieChart, { readings: [{ cefrLevel: 'B2' }] }));
  assert.match(html, /<circle/);
  assert.match(html, /100%/);
  assert.match(html, /class="reading-distribution__segment"/);
});

test('adding and deleting readings recomputes actual counts and slices', () => {
  const readings = [{ cefrLevel: 'A2' }, { cefrLevel: 'C1' }];
  assert.equal(readingLevelDistribution(readings).find(item => item.level === 'A2')!.percentage, 50);
  assert.equal(readingLevelDistribution(readings.slice(0, 1)).find(item => item.level === 'A2')!.percentage, 100);
  const html = renderToStaticMarkup(React.createElement(ReadingLevelPieChart, { readings }));
  assert.equal((html.match(/class="reading-distribution__segment"/g) || []).length, 2);
});

test('vocabulary uses actual word levels, not passage levels; filters keep original records', () => {
  const records = [{ cefrLevel: 'B1', selectedVocabulary: [{ cefrLevel: 'A1' }, { cefrLevel: 'C2' }, {}] }, { cefrLevel: 'A2', selectedVocabulary: [{ cefrLevel: 'C2' }] }];
  const values = readingLevelDistribution(distributionSource(records, 'vocabulary'));
  assert.equal(values.find(item => item.level === 'C2')!.percentage, 50);
  assert.equal(values.find(item => item.level === '未知')!.count, 1);
  assert.deepEqual(filterReadingsByLevel(records, 'A1', 'vocabulary'), [records[0]]);
  assert.deepEqual(filterReadingsByLevel(records, 'A2', 'readings'), [records[1]]);
  assert.deepEqual(filterReadingsByLevel(records, null, 'readings'), records);
  assert.equal(filterReadingsByLevel(records, 'B2', 'readings').length, 0);
});

test('chart exposes six filter buttons and vocabulary dimension with truthful totals', () => {
  const html = renderToStaticMarkup(React.createElement(ReadingLevelPieChart, { readings: [{ cefrLevel: 'B1', selectedVocabulary: [{ cefrLevel: 'C2' }] }], dimension: 'vocabulary', selectedLevel: 'C2' }));
  assert.match(html, /1 篇情境短文及 1 条精选词汇/);
  assert.match(html, />C2<\/span><strong>1 词<\/strong><small>100%/);
  assert.doesNotMatch(html, /当前筛选：C2/);
  assert.match(html, /图例 C2：1 词，100%/);
  assert.match(html, /筛选 C2：1 词，100%/);
});

test('history shows factual metadata without topic, body preview, search or fake progress', () => {
  const reading = { id: '1', title: 'A saved passage', topic: 'HIDDEN TOPIC', content: 'HIDDEN BODY', cefrLevel: 'B1', readingType: 'dialogue', length: 'medium', createdAt: 1720000000000 } as ReadingRecord;
  const html = renderToStaticMarkup(React.createElement(ReadingHistoryView, { readings: [reading], onSelectReading: () => {}, onDeleteReading: async () => {} }));
  assert.match(html, /A saved passage/);
  assert.match(html, /中 · 150–200 词/);
  assert.match(html, /aria-label="阅读：A saved passage"/);
  assert.doesNotMatch(html, /HIDDEN TOPIC|HIDDEN BODY|type="search"|仅看已读完|继续阅读|再次阅读/);
});

test('default chart totals do not select a dominant level, including a tie', () => {
  const html = renderToStaticMarkup(React.createElement(ReadingLevelPieChart, { readings: [{cefrLevel:'A2'},{cefrLevel:'B1'},{cefrLevel:'B2'}] }));
  assert.match(html, />总计<\/span><strong>3 篇<\/strong><small>学习短文/);
  assert.doesNotMatch(html, /aria-pressed="true"[^>]*aria-label="筛选|主修核心等级/);
  assert.match(html, /A1 入门：0 篇，0%/);
  assert.match(html, /B2 中高级：1 篇，33.3%/);
});

test('selected level dims other actual slices and uses the shared CEFR color', () => {
  const html = renderToStaticMarkup(React.createElement(ReadingLevelPieChart, { readings: [{cefrLevel:'A2'},{cefrLevel:'B2'}], selectedLevel:'B2' }));
  assert.match(html, /fill="#E6C394" style="opacity:0.2"/);
  assert.match(html, /fill="#B69CAF" style="opacity:1"/);
  assert.match(html, /--cefr-background:#F4EBF2/);
  assert.match(html, />B2<\/span><strong>1 篇<\/strong><small>50%/);
});

test('stale deleted level returns to the total and unknown data is counted honestly', () => {
  const html = renderToStaticMarkup(React.createElement(ReadingLevelPieChart, { readings: [{cefrLevel:'B1'},{}], selectedLevel:'B2' }));
  assert.match(html, />总计<\/span><strong>2 篇/);
  assert.match(html, /未标注等级：1 篇（50%），已计入总数/);
  assert.doesNotMatch(html, /当前筛选：B2/);
});
