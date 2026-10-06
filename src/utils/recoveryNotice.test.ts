import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecoveryNotice } from '../components/RecoveryNotice';

test('recovery notices announce the actual problem and disable retry while pending', () => {
  let calls = 0;
  const html = renderToStaticMarkup(React.createElement(RecoveryNotice, { message: '已有词条保留', onRetry: () => { calls++; }, pending: true }));
  assert.match(html, /role="alert"/);
  assert.match(html, /已有词条保留/);
  assert.match(html, /disabled=""/);
  assert.match(html, /正在重试/);
  assert.equal(calls, 0);
});
