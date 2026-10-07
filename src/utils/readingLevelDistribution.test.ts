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
  assert.match(html, /暂无等级数据/);
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
  assert.match(html, /MASTERY/);
  assert.match(html, /1 条 · 100.0%/);
  assert.equal((html.match(/aria-pressed=/g) || []).length, 9);
  assert.match(html, /筛选 C2：1 条，100%/);
});

test('history shows factual metadata without topic, body preview, search or fake progress', () => {
  const reading = { id: '1', title: 'A saved passage', topic: 'HIDDEN TOPIC', content: 'HIDDEN BODY', cefrLevel: 'B1', readingType: 'dialogue', length: 'medium', createdAt: 1720000000000 } as ReadingRecord;
  const html = renderToStaticMarkup(React.createElement(ReadingHistoryView, { readings: [reading], onSelectReading: () => {}, onDeleteReading: () => {} }));
  assert.match(html, /A saved passage/);
  assert.match(html, /中 · 150–200 词/);
  assert.match(html, /继续阅读/);
  assert.doesNotMatch(html, /HIDDEN TOPIC|HIDDEN BODY|type="search"|已读/);
});
