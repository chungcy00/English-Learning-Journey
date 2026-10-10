import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProcessingModal, summarizeGenerationTopic } from '../components/ProcessingModal';

const render = (props = {}) => renderToStaticMarkup(React.createElement(ProcessingModal, { isOpen: true, status: 'Generating reading...', canCancel: true, topic: '如何礼貌地拒绝别人', onCancel: () => {}, ...props }));

test('generation dialog announces the submitted topic with one title and complete cancellation notes', () => {
  const html = render();
  for (const text of ['正在为你定制专属短文…', '正在根据「如何礼貌地拒绝别人」构思内容，请稍候。', '取消本次操作', '取消不会更改已有短文或清空输入。', '已发送的 AI 请求仍可能计入额度。']) assert.ok(html.includes(text));
  assert.match(html, /aria-describedby="processing-description processing-note"/);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(html, /animate-spin|正在准备|预计|progressbar|>\d+%/);
  assert.equal((html.match(/取消不会更改/g) || []).length, 1);
});

test('long mixed-language topics produce a bounded display summary without mutating the original', () => {
  const input = '  如何礼貌地拒绝别人\n' + 'a long English phrase with emoji 🌱 '.repeat(20);
  const summary = summarizeGenerationTopic(input);
  assert.equal(Array.from(summary).length, 49);
  assert.ok(summary.endsWith('…'));
  assert.doesNotMatch(summary, /\n|�/);
  assert.ok(input.includes('\n'));
  const html = render({ topic: input });
  assert.ok(html.includes(`正在根据「${summary}」构思内容，请稍候。`));
  assert.equal(summarizeGenerationTopic('  genuine\n kind  '), 'genuine kind');
});

test('saving is truthful and noncancelable; rewrite does not claim to generate a new topic', () => {
  const saving = render({status:'Saving', canCancel:false});
  assert.ok(saving.includes('正在保存短文…'));
  assert.match(saving, /disabled=""[^>]*class="processing-dialog__cancel"/);
  assert.ok(saving.includes('正在保存你的学习内容，请稍候。'));
  const rewrite = render({operation:'rewrite'});
  assert.ok(rewrite.includes('正在改写短文…'));
  assert.doesNotMatch(rewrite, /正在根据「/);
  assert.equal(render({isOpen:false}), '');
});
