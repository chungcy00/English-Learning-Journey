import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Navbar } from '../components/Navbar';
import { InstalledAppBottomNav } from '../components/InstalledAppBottomNav';
import { WordbookEntryDetails } from '../components/WordbookEntryDetails';
import { basicVocabulary } from './vocabularyDetails';
test('browser and installed navigation expose an independent wordbook destination with exactly one selected tab',()=>{
 for(const component of [Navbar,InstalledAppBottomNav]){
  const html=renderToStaticMarkup(React.createElement(component,{activeTab:'wordbook',setActiveTab:()=>{},reviewCount:5,hasCurrentReading:false}));
  assert.match(html,/aria-label="单词"[^>]*aria-current="page"|aria-current="page"[^>]*aria-label="单词"/);
  assert.equal(html.split('aria-current="page"').length-1,1);
  assert.match(html,/grid-cols-5/);
 }
});
test('wordbook detail keeps removal without redundant saved-state and retention captions',()=>{
 const html=renderToStaticMarkup(React.createElement(WordbookEntryDetails,{vocab:basicVocabulary('helpful'),reading:null,onRemove:async()=>{}}));
 assert.ok(!html.includes('已加入生词本'));assert.ok(!html.includes('独立收藏的例句和词组会单独保留。'));assert.ok(html.includes('移出生词本：helpful'));
});
