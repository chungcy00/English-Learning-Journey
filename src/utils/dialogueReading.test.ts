import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseDialogueTurns, mappedDialogueTranslation } from './dialogueReading';
import { ReadingView } from '../views/ReadingView';
import type { ReadingRecord, ReadingTranslation } from '../types';

test('dialogue parsing retains scenes, multiple names, same-speaker turn boundaries and continuous sentences', () => {
  const turns = parseDialogueTurns('At the station.\nMaya: Look outside. The train is here.\nMaya: Wait for me!\nDr Lee: Take your time.\nAlex: Ready?');
  assert.deepEqual(turns.map(t=>t.speaker),[null,'Maya','Maya','Dr Lee','Alex']);
  assert.equal(turns[1].speech,'Look outside. The train is here.');
  assert.deepEqual(parseDialogueTurns('Maya: Hello. Alex: Welcome!').map(t=>t.speaker),['Maya','Alex']);
});

test('translated dialogue derives identity from exact English mappings without guessing by Chinese punctuation or labels', () => {
  const turns = parseDialogueTurns('Maya: Hello. Welcome!\nAlex: Thank you.\nMaya: Come inside.');
  const translation = {translatedContent:'玛雅：你好，欢迎！亚历克斯：谢谢。',sentenceTranslations:[
    {source:'Hello.',translation:'你好。'},{source:'Welcome!',translation:'欢迎！'},
    {source:'Thank you.',translation:'谢谢。'},{source:'Come inside.',translation:'请进。'}
  ]} as ReadingTranslation;
  assert.deepEqual(mappedDialogueTranslation(turns,translation),[
    {speaker:'Maya',speech:'你好。 欢迎！'},{speaker:'Alex',speech:'谢谢。'},{speaker:'Maya',speech:'请进。'}
  ]);
  assert.equal(mappedDialogueTranslation(turns,{...translation,sentenceTranslations:translation.sentenceTranslations!.slice(0,2)}),null);
  assert.equal(mappedDialogueTranslation(turns,{...translation,sentenceTranslations:[...translation.sentenceTranslations!,{source:'Hello.',translation:'另一译文。'}]}),null);
  assert.equal(mappedDialogueTranslation(turns,{translatedContent:'你好！谢谢。'} as ReadingTranslation),null);
});

test('dialogue shares the reading player and word modal, with compact roles and no normal turn cards', () => {
  const reading = {id:'dialogue',title:'Meeting at the station',content:'Maya: Look outside. The train is here.\nAlex: Take your time.',readingType:'dialogue',cefrLevel:'B2',selectedVocabulary:[],rewritePractice:[]} as unknown as ReadingRecord;
  const html=renderToStaticMarkup(React.createElement(ReadingView,{reading,knownVocabulary:[],wordbookVocabIds:new Set(),onToggleWordbook:()=>{},onUpdateVocabulary:async()=>{},onRewrite:()=>{},onOpenHistory:()=>{},isRewriting:false}));
  assert.match(html,/reading-studio--dialogue/);
  assert.equal((html.match(/class="reading-dialogue-turn "/g)||[]).length,2);
  assert.equal((html.match(/aria-label="英文朗读播放器"/g)||[]).length,1);
  assert.match(html,/reading-dialogue-name">Maya/);
  assert.match(html,/查看句子翻译：The train is here\./);
  assert.doesNotMatch(html,/PDF|角色朗读|rounded-sm bg-\[var\(--surface-paper\)\]\/80/);
});


test('combined translations preserve turns and never absorb another speaker', () => {
  const turns = [{speaker:'Maya',speech:'Hello. Welcome!'},{speaker:'Alex',speech:'Thank you.'}];
  const translation = {sentenceTranslations:[{source:'Hello. Welcome!',translation:'你好，欢迎！'},{source:'Thank you.',translation:'谢谢。'}]} as ReadingTranslation;
  assert.deepEqual(mappedDialogueTranslation(turns,translation),[{speaker:'Maya',speech:'你好，欢迎！'},{speaker:'Alex',speech:'谢谢。'}]);
  assert.equal(mappedDialogueTranslation(turns,{sentenceTranslations:[{source:'Hello. Welcome! Thank you.',translation:'跨角色译文。'}]} as ReadingTranslation),null);
});
