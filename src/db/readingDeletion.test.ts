import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { db, deleteReading, initDefaultData } from './dexie';
import type { ReadingRecord, VocabularyItem } from '../types';

const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis,'localStorage');
beforeEach(async () => {
  const data = new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key) ?? null,setItem:(key:string,value:string)=>data.set(key,value)}});
  await db.delete(); await db.open();
});
afterEach(async () => {
  await db.delete();
  if (storageDescriptor) Object.defineProperty(globalThis,'localStorage',storageDescriptor);
  else Reflect.deleteProperty(globalThis,'localStorage');
});

async function fixture() {
  const exclusive = {id:'exclusive',term:'courage',sourceReadingId:'a',savedManually:true,status:'Learning',reviewCount:3,nextReviewDate:99} as VocabularyItem;
  const shared = {id:'shared',term:'nerve',sourceReadingId:'a',status:'Mastered',reviewCount:8,nextReviewDate:999} as VocabularyItem;
  await db.readings.bulkPut([{id:'a',cefrLevel:'B1',selectedVocabulary:[exclusive,shared]},{id:'b',cefrLevel:'B2',selectedVocabulary:[{...shared,id:'copy'}]}] as ReadingRecord[]);
  await db.vocabulary.bulkPut([exclusive,shared]);
  await db.reviews.bulkAdd([{vocabularyId:'exclusive',rating:'Good',reviewedAt:1,interval:3},{vocabularyId:'shared',rating:'Easy',reviewedAt:2,interval:7}]);
  await db.notes.bulkAdd([{targetId:'exclusive',content:'Note',createdAt:1,updatedAt:1},{targetId:'shared',content:'Shared note',createdAt:1,updatedAt:1},{targetId:'a',content:'Passage note',createdAt:1,updatedAt:1}]);
  await db.rewriteRecords.add({readingId:'a',originalSentence:'Example',target:'nerve',userAnswer:'Answer',rating:'Good',createdAt:1});
}

test('deleting a reading cascades exclusive vocabulary, reviews, notes and exercises in one transaction', async () => {
  await fixture(); await deleteReading('a');
  assert.equal(await db.readings.get('a'),undefined); assert.equal(await db.vocabulary.get('exclusive'),undefined);
  const shared = (await db.vocabulary.get('shared'))!;
  assert.equal(shared.sourceReadingId,'b'); assert.equal(shared.reviewCount,8); assert.equal(shared.nextReviewDate,999);
  assert.deepEqual((await db.reviews.toArray()).map(item=>item.vocabularyId),['shared']);
  assert.deepEqual((await db.notes.toArray()).map(item=>item.targetId),['shared']);
  assert.equal(await db.rewriteRecords.count(),0);
  await deleteReading('a'); assert.equal(await db.vocabulary.count(),1);
  await deleteReading('b'); assert.equal(await db.vocabulary.count(),0); assert.equal(await db.reviews.count(),0);
});

test('a failure midway through cascade rolls back passage, vocabulary and review deletions', async () => {
  await fixture();
  const rejectDeletion = () => { throw new Error('Simulated storage failure'); };
  db.notes.hook('deleting',rejectDeletion);
  try { await assert.rejects(deleteReading('a'),/Simulated storage failure/); }
  finally { db.notes.hook('deleting').unsubscribe(rejectDeletion); }
  assert.ok(await db.readings.get('a')); assert.equal(await db.vocabulary.count(),2);
  assert.equal((await db.vocabulary.get('shared'))?.sourceReadingId,'a');
  assert.equal(await db.reviews.count(),2); assert.equal(await db.notes.count(),3);
});

test('deleting the last passage does not recreate bundled words on the next load', async () => {
  await initDefaultData(); const first = (await db.readings.toArray())[0];
  assert.ok(first); await deleteReading(first.id); await initDefaultData();
  assert.equal(await db.readings.count(),0); assert.equal(await db.vocabulary.count(),0);
});
