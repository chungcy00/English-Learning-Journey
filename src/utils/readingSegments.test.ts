import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { splitReadingSentences, groupReadingSentences, getSentenceTranslation, hasCompleteSentenceTranslations, formatAudioTime } from './readingSegments';
import { ReadingView } from '../views/ReadingView';
import { WordDetailModal } from '../components/WordDetailModal';
import type { ReadingRecord, ReadingTranslation, VocabularyItem } from '../types';

const vocab = { id:'term', term:'genuine', type:'word', partOfSpeech:'adjective', phonetic:'/ˈdʒen.ju.ɪn/', meaningZh:'真诚的', definitionEn:'Real and sincere.', example:'She gave a genuine smile.', collocations:['genuine concern'] } as VocabularyItem;
const reading = { topic:'Rainy day', input:'Rainy day', length:'medium', humanised:true, createdAt:0, updatedAt:0, id:'reading', title:'A real article', content:'Dr. Maya paid $3.50 for tea. Her smile was genuine!', cefrLevel:'B1', readingType:'story', selectedVocabulary:[vocab], rewritePractice:[], translations:{'zh-CN':{language:'zh-CN', languageName:'简体中文', title:'真实短文', updatedAt:0, translatedContent:'玛雅博士买了茶。她的微笑很真诚！', sentenceTranslations:[{source:'Her smile was genuine!',translation:'她的微笑很真诚！'}]}} } as ReadingRecord;

test('sentence boundaries preserve abbreviations, decimal numbers, punctuation and exact text', () => {
  const original = 'Dr. Maya paid $3.50 for tea. “Really?” she asked. Yes!';
  const sentences = splitReadingSentences(original);
  assert.equal(sentences.join(''), original);
  assert.equal(sentences[0].trim(), 'Dr. Maya paid $3.50 for tea.');
  assert.ok(sentences.some(sentence => sentence.includes('“Really?”')));
});
test('inline translations require an exact, unambiguous source mapping', () => {
  assert.equal(getSentenceTranslation('Her smile was genuine!', reading.translations!['zh-CN']), '她的微笑很真诚！');
  assert.equal(getSentenceTranslation('An unknown sentence.', reading.translations!['zh-CN']), undefined);
  assert.equal(getSentenceTranslation('A.', {translatedContent:'甲。'} as ReadingTranslation), undefined);
  assert.equal(getSentenceTranslation('A.', {sentenceTranslations:[{source:'A.',translation:'甲。'},{source:'A.',translation:'乙。'}]} as ReadingTranslation), undefined);
  assert.equal(getSentenceTranslation('A.', {sentenceTranslations:[{source:'A.',translation:''}]} as ReadingTranslation), undefined);
});
test('player times only expose actual finite measurements', () => {
  assert.equal(formatAudioTime(null), '—:—');
  assert.equal(formatAudioTime(NaN), '—:—');
  assert.equal(formatAudioTime(-1), '—:—');
  assert.equal(formatAudioTime(125.5), '02:05');
});
test('legacy and partial caches require upgrading; only complete unambiguous mappings can be reused', () => {
  const sources = ['First.', 'Second.'];
  assert.equal(hasCompleteSentenceTranslations(sources, undefined), false);
  assert.equal(hasCompleteSentenceTranslations(sources, {translatedContent:'第一。第二。'} as ReadingTranslation), false);
  const partial = {sentenceTranslations:[{source:'First.',translation:'第一。'}]} as ReadingTranslation;
  assert.equal(hasCompleteSentenceTranslations(sources, partial), false);
  const complete = {...partial, sentenceTranslations:[...partial.sentenceTranslations!,{source:'Second.',translation:'第二。'}]};
  assert.equal(hasCompleteSentenceTranslations(sources, complete), true);
  assert.equal(hasCompleteSentenceTranslations(sources, {...complete, sentenceTranslations:[...complete.sentenceTranslations,{source:'Second.',translation:'另一个译文。'}]}), false);
});
test('reading keeps a single player, real metadata, matching sentence actions and no removed export feature', () => {
  const html = renderToStaticMarkup(React.createElement(ReadingView,{reading,knownVocabulary:[],wordbookVocabIds:new Set(),onToggleWordbook:()=>{},onUpdateVocabulary:async()=>{},onRewrite:()=>{},onOpenHistory:()=>{},onOpenPractice:()=>{},isRewriting:false}));
  assert.ok(html.includes('A real article'));
  assert.equal((html.match(/aria-label="英文朗读播放器"/g)||[]).length,1);
  assert.ok(html.includes('本篇精选词汇'));
  assert.ok(html.includes('开始句子改写练习'));
  assert.ok(html.includes('查看句子翻译：Her smile was genuine!'));
  assert.ok(html.includes('查看句子翻译：Dr. Maya paid $3.50 for tea.'));
  assert.doesNotMatch(html,/PDF|LanguageSelector/);
});
test('reading word details use the shared centered dialog with fixed actions and complete content', () => {
  const html = renderToStaticMarkup(React.createElement(WordDetailModal,{vocab,isOpen:true,readingContext:true,onClose:()=>{},onToggleWordbook:()=>{},isInWordbook:true}));
  for(const content of ['中文释义','英英释义',vocab.example,'genuine concern','已加入生词本','移出']) assert.ok(html.includes(content));
  assert.match(html,/class="app-dialog word-detail-dialog reading-word-dialog"/);
  assert.match(html,/reading-word-dialog__footer/);
  assert.doesNotMatch(html,/<aside|<details|border-l/);
});


test('multi-sentence source mappings stay one exact span and preserve original spacing', () => {
  const text = 'Dr. Maya arrived.  Her smile was genuine! Next came tea.';
  const translation = {sentenceTranslations:[
    {source:'Dr. Maya arrived. Her smile was genuine!',translation:'玛雅博士带着真诚的微笑到了。'},
    {source:'Next came tea.',translation:'随后端来了茶。'}
  ]} as ReadingTranslation;
  const grouped = groupReadingSentences(splitReadingSentences(text), translation);
  assert.equal(grouped.length, 2);
  assert.equal(grouped.map(part => part.source).join(''), text);
  assert.equal(grouped[0].translation, '玛雅博士带着真诚的微笑到了。');
  assert.equal(grouped[1].index, 2);
  assert.equal(hasCompleteSentenceTranslations(splitReadingSentences(text), translation), true);
  assert.equal(hasCompleteSentenceTranslations(splitReadingSentences('Her smile was genuine!'), translation), false);
});

test('competing grouped spans and conflicting combined translations remain unavailable', () => {
  const sources = splitReadingSentences('First. Second. Third.');
  const mappings = [{source:'First. Second.',translation:'一二。'},{source:'First. Second. Third.',translation:'一二三。'}];
  assert.equal(groupReadingSentences(sources,{sentenceTranslations:mappings} as ReadingTranslation)[0].translation, undefined);
  assert.equal(hasCompleteSentenceTranslations(sources,{sentenceTranslations:[mappings[1],{...mappings[1],translation:'另一个译文。'}]} as ReadingTranslation),false);
});
