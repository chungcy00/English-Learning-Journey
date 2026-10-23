import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {wordbookExampleTranslation} from './wordbookDetails';
import {WordbookEntryDetails} from '../components/WordbookEntryDetails';
import type {ReadingRecord,VocabularyItem} from '../types';
const vocab={id:'saved',term:'considerate',type:'word',partOfSpeech:'adjective',phonetic:'/kənˈsɪd.ər.ət/',meaningZh:'体贴的；考虑周到的',definitionEn:'Thoughtful.',example:'She said, “That was considerate.”',collocations:['considerate of others','a considerate person'],status:'Learning'} as VocabularyItem;
const reading={id:'r',selectedVocabulary:[{...vocab,id:'generated'}],translations:{'zh-CN':{vocabularyTranslations:{generated:{meaning:'体贴的',exampleTranslation:'她说：“那很体贴。”'}}}}} as unknown as ReadingRecord;
test('example cache is reused only when it describes the exact same example',()=>{
 assert.equal(wordbookExampleTranslation(vocab,reading),'她说：“那很体贴。”');
 assert.equal(wordbookExampleTranslation({...vocab,example:'A different example.'},reading),undefined);
 assert.equal(wordbookExampleTranslation(vocab,null),undefined);
 assert.equal(wordbookExampleTranslation({...vocab,translations:{'zh-CN':{meaning:'体贴的',exampleTranslation:'词条自身译文'}}},reading),'词条自身译文');
});
test('inline details do not duplicate the term metadata or add modal semantics',()=>{
 const html=renderToStaticMarkup(React.createElement(WordbookEntryDetails,{vocab,reading,onUpdateStatus:async()=>{},onRemove:async()=>{}}));
 assert.doesNotMatch(html,/<dialog|<aside|<h2|adjective|· word|wordbook-detail-panel/);
 for(const content of ['中文释义','英英释义',vocab.definitionEn,vocab.example,'她说：“那很体贴。”','已加入生词本','移出','学习状态'])assert.ok(html.includes(content));
 assert.match(html,/wordbook-detail-pronunciation/);
 assert.match(html,/aria-label="播放 considerate 的发音"/);
 assert.match(html,/value="Learning" selected=""|selected="" value="Learning"/);
});
test('missing example translation adds no invented filler or unrelated cache',()=>{
 const html=renderToStaticMarkup(React.createElement(WordbookEntryDetails,{vocab,reading:null,onUpdateStatus:async()=>{},onRemove:async()=>{}}));
 assert.doesNotMatch(html,/她说|暂无翻译|店主/);
 assert.match(html,/She said, “That was considerate.”/);
});

test('matching reading examples can reuse the saved-record ID cache without borrowing another example',()=>{
 const bySavedId={...reading,translations:{'zh-CN':{vocabularyTranslations:{saved:{meaning:'体贴的',exampleTranslation:'按已存词条 ID 缓存的真实译文'}}}}} as unknown as ReadingRecord;
 assert.equal(wordbookExampleTranslation(vocab,bySavedId),'按已存词条 ID 缓存的真实译文');
 assert.equal(wordbookExampleTranslation({...vocab,example:'Unrelated example.'},bySavedId),undefined);
});
test('exact source sentence translations can serve manually added terms without selected vocabulary',()=>{
 const sentenceReading={...reading,selectedVocabulary:[],translations:{'zh-CN':{sentenceTranslations:[
  {source:'A different example.',translation:'其他例句译文'},
  {source:` ${vocab.example} `,translation:'同一句英文的逐句译文'},
 ]}}} as unknown as ReadingRecord;
 assert.equal(wordbookExampleTranslation(vocab,sentenceReading),'同一句英文的逐句译文');
 assert.equal(wordbookExampleTranslation({...vocab,example:'No matching sentence.'},sentenceReading),undefined);
 assert.equal(wordbookExampleTranslation({...vocab,translations:{'zh-CN':{meaning:'体贴的',exampleTranslation:'词条自身译文'}}},sentenceReading),'词条自身译文');
});
