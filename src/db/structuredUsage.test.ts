import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {db} from './dexie';
import {basicVocabulary,legacyDetails} from '../utils/vocabularyDetails';
import {readVocabularyDetails,saveVocabularyDetails,generateVocabularyDetails} from '../services/vocabularyDetails';
import {emptyUsage,usageEntry} from '../utils/structuredUsage';
beforeEach(async()=>{Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});await db.delete();await db.open()});
afterEach(async()=>{await db.delete();Reflect.deleteProperty(globalThis,'window')});
test('old records are read in the new format without overwriting storage or calling AI; save preserves the original and progress',async()=>{
 const word={...basicVocabulary('interfere'),id:'saved',nextReviewDate:888,reviewCount:9};
 const details=legacyDetails(word);details.generated=true;
 const entry={id:'legacy',text:'旧标题',meaningZh:'完整说明',usageKind:'natural' as const,example:'A sentence.',note:'原有备注'};
 details.sections.usage=[entry];details.provenance.usage={source:'user',updatedAt:1};
 await db.vocabulary.put({...word,details});await db.vocabularyDetails.put(details);
 const converted=await readVocabularyDetails(word);
 assert.equal(converted.sections.usage[0].usage?.version,2);
 assert.deepEqual(await db.vocabularyDetails.get(details.key),details);
 await saveVocabularyDetails(converted);db.close();await db.open();
 const reopened=await readVocabularyDetails(word);
 assert.deepEqual(reopened.sections.usage[0].usage?.compatibility?.original,entry);
 assert.equal((await db.vocabulary.get(word.id))?.reviewCount,9);
 assert.equal((await db.vocabulary.get(word.id))?.nextReviewDate,888);
 assert.deepEqual((await db.vocabulary.get(word.id))?.details?.sections.usage,reopened.sections.usage);
});
test('edits made while usage regenerates survive even when replacement had been confirmed',async()=>{
 const word=basicVocabulary('interfere');const details=legacyDetails(word);details.generated=true;
 await db.vocabularyDetails.put(details);
 const realFetch=globalThis.fetch;
 globalThis.fetch=async()=>{
   const latest=await readVocabularyDetails(word);const point=emptyUsage();point.scenario={name:'手动场景',explanation:'用户刚刚填写的内容。',examples:[],tip:''};
   latest.sections.usage=[usageEntry('manual',point)];latest.provenance.usage={source:'user',updatedAt:2};await saveVocabularyDetails(latest);
   return new Response(JSON.stringify({...details,sections:{...details.sections,usage:[]}}));
 };
 try{await assert.rejects(generateVocabularyDetails(word,'usage',true),/生成期间本栏已被编辑/);assert.equal((await readVocabularyDetails(word)).sections.usage[0].id,'manual')}finally{globalThis.fetch=realFetch}
});
test('simultaneous editors use an atomic usage comparison and retain the first committed edit',async()=>{
 const word=basicVocabulary('interfere');const details=legacyDetails(word);await saveVocabularyDetails(details);
 const original=(await readVocabularyDetails(word)).sections.usage;
 const change=(id:string)=>{const point=emptyUsage();point.scenario={name:id,explanation:'中文说明。',examples:[],tip:''};return {...details,sections:{...details.sections,usage:[usageEntry(id,point)]}}};
 const results=await Promise.allSettled([saveVocabularyDetails(change('first'),original),saveVocabularyDetails(change('second'),original)]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal((await readVocabularyDetails(word)).sections.usage[0].id,'first');
});
