import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readingLevelDistribution } from './readingLevelDistribution';
import { ReadingLevelPieChart } from '../components/ReadingLevelPieChart';
import { ReadingHistoryView } from '../views/ReadingHistoryView';
import type { ReadingRecord } from '../types';

test('empty readings have no invented distribution', () => {
  assert.ok(readingLevelDistribution([]).every(item => item.count === 0 && item.percentage === 0));
  const html = renderToStaticMarkup(React.createElement(ReadingLevelPieChart, { readings: [] }));
  assert.match(html, /保存短文后显示等级分布/);
  assert.doesNotMatch(html, /<svg/);
});

test('single level is a full circle; missing and unsupported levels remain unknown', () => {
  const values = readingLevelDistribution([{ cefrLevel: 'B1' }, {}, { cefrLevel: 'A1' }]);
  assert.equal(values.find(item => item.level === 'B1')!.count, 1);
  assert.equal(values.find(item => item.level === '未知')!.count, 2);
  const html = renderToStaticMarkup(React.createElement(ReadingLevelPieChart, { readings: [{ cefrLevel: 'B2' }] }));
  assert.match(html, /<circle/);
  assert.match(html, /100%/);
  assert.doesNotMatch(html, /<path/);
});

test('adding and deleting readings recomputes actual counts and slices', () => {
  const readings = [{ cefrLevel: 'A2' }, { cefrLevel: 'C1' }];
  assert.equal(readingLevelDistribution(readings)[0].percentage, 50);
  assert.equal(readingLevelDistribution(readings.slice(0, 1))[0].percentage, 100);
  const html = renderToStaticMarkup(React.createElement(ReadingLevelPieChart, { readings }));
  assert.equal((html.match(/<path/g) || []).length, 2);
});

test('history shows factual metadata without topic, body preview, search or fake progress', () => {
  const reading = { id: '1', title: 'A saved passage', topic: 'HIDDEN TOPIC', content: 'HIDDEN BODY', cefrLevel: 'B1', readingType: 'dialogue', length: 'medium', createdAt: 1720000000000 } as ReadingRecord;
  const html = renderToStaticMarkup(React.createElement(ReadingHistoryView, { readings: [reading], onSelectReading: () => {}, onDeleteReading: () => {} }));
  assert.match(html, /A saved passage/);
  assert.match(html, /中 · 150–200 词/);
  assert.match(html, /继续阅读/);
  assert.doesNotMatch(html, /HIDDEN TOPIC|HIDDEN BODY|type="search"|已读/);
});
