import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CustomWordsView} from '../views/CustomWordsView';
import {isCustomVocabulary} from './customVocabulary';
import {basicVocabulary} from './vocabularyDetails';
import {readFileSync} from 'node:fs';

test('manual view includes manual and unlinked legacy entries, never ordinary article bookmarks',()=>{
 const word=basicVocabulary('helpful');assert.ok(isCustomVocabulary(word));
 assert.ok(isCustomVocabulary({...word,origin:undefined,savedManually:true}));
 assert.ok(!isCustomVocabulary({...word,origin:'reading',sourceReadingId:'r',savedManually:true}));
 assert.ok(!isCustomVocabulary({...word,origin:undefined,addedFromReadingIds:['r'],savedManually:true}));
 assert.ok(!isCustomVocabulary({...word,origin:undefined,sourceReadingId:'r',savedManually:true}));
 // A word deliberately added to both places retains its article association.
 assert.ok(isCustomVocabulary({...word,origin:'manual',sourceReadingId:'r'}));
});
test('custom navigation renders a dedicated page with its form open and only manual entries',()=>{
 const manual=basicVocabulary('helpful');const article={...basicVocabulary('article-expression'),origin:'reading' as const,sourceReadingId:'r'};
 const html=renderToStaticMarkup(React.createElement(CustomWordsView,{vocabulary:[manual,article],onSave:async()=>{},onRequestRemove:()=>{}}));
 for(const text of ['自定义单词','英语词条','检查并预览','我添加的词条','helpful'])assert.ok(html.includes(text));
 for(const text of ['article-expression','My Wordbook','开始复习','单独收藏的例句'])assert.ok(!html.includes(text));
 assert.ok(!html.includes('wordbook-custom-toggle'));assert.ok(html.includes('lexicon-add-form'));assert.ok(!html.includes('type="select"'));
});
test('original article addition remains in the existing wordbook while custom words mount separately',()=>{
 const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');const book=readFileSync(new URL('../views/WordbookView.tsx',import.meta.url),'utf8');
 assert.match(app,/activeTab === 'words' && <CustomWordsView/);assert.match(app,/activeTab === 'wordbook'/);
 assert.match(book,/wordbookSuggestions\(currentReading/);assert.match(book,/sourceReadingId:item.sourceReadingId\|\|reading.id/);
 assert.match(book,/<SavedMaterialsView/);assert.match(book,/onGenerateFromWordbook/);
});
