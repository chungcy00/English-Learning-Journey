import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { uniqueRewriteQuestions } from './rewriteQuestions';
import { RewritePracticeView } from '../views/RewritePracticeView';
import type { ReadingRecord, RewritePracticeItem } from '../types';
const item: RewritePracticeItem = {id:'single-input',target:'genuine',originalSentence:'The welcome was sincere.',referenceAnswer:'The welcome was genuine.'};
test('duplicate exercises collapse by content identity while reused IDs with different content remain separate', () => {
  const changed = {...item, target:'warm'};
  assert.deepEqual(uniqueRewriteQuestions('reading', [item, {...item}, changed]), [item, changed]);
});
test('single question starts blank, reference closed, evaluation disabled, first question has no previous button', () => {
  const reading = {id:'single-view-test',cefrLevel:'B1',rewritePractice:[item,{...item,id:'second',target:'considerate'}]} as ReadingRecord;
  const html = renderToStaticMarkup(React.createElement(RewritePracticeView,{reading,onBack(){}}));
  assert.equal((html.match(/<textarea/g)||[]).length,1);
  assert.match(html, /0 \/ 2 已评估/);
  assert.match(html, /aria-current="step"/);
  assert.match(html, /placeholder="在这里输入你的英文改写…"/);
  assert.match(html, /disabled="" class="rewrite-check"/);
  assert.doesNotMatch(html, /返回上一题|The welcome was genuine\./);
});

test('completed count uses returned evaluations, and an evaluated current step retains its completion state', () => {
  const evaluation = {rating:'Good',meaningPreserved:true,targetUsedCorrectly:true,whatYouDidWell:[],issues:[],improvedVersion:'It was genuine.',referenceAnswer:'It was genuine.'} as const;
  const reading = {id:'evaluated-view-test',cefrLevel:'B1',rewritePractice:[{...item,id:'evaluated-step',evaluation}, {...item,id:'draft-only',userAnswer:'A draft.'}]} as unknown as ReadingRecord;
  const html = renderToStaticMarkup(React.createElement(RewritePracticeView,{reading,onBack(){}}));
  assert.match(html, /1 \/ 2 已评估/);
  assert.match(html, /value="1" max="2"/);
  assert.match(html, /第 1 题，已评估，当前/);
  assert.match(html, /is-evaluated is-current/);
});
