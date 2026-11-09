import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { db, EnglishLearningDatabase, deleteVocabulary, exportMyData, importMyData, initDefaultData } from './dexie';
import { basicVocabulary, legacyDetails, vocabularyKey } from '../utils/vocabularyDetails';
import { generateVocabularyDetails, saveVocabularyDetails, toggleMaterial } from '../services/vocabularyDetails';

beforeEach(async () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  await db.delete();
});
afterEach(async () => { await db.delete(); Reflect.deleteProperty(globalThis, 'window'); Reflect.deleteProperty(globalThis, 'localStorage'); });
const oldStores = { readings: 'id, createdAt, topic, cefrLevel, readingType', vocabulary: 'id, term, status, nextReviewDate, createdAt, updatedAt', reviews: '++id, vocabularyId, reviewedAt, rating', rewriteRecords: '++id, readingId, target, createdAt', notes: '++id, targetId, createdAt', dialogueAudio: 'id, createdAt, lastPlayedAt' };
async function oldDatabase() {
  const old = new Dexie('EnglishLearningDB'); old.version(2).stores(oldStores); await old.open(); return old;
}
test('v2 upgrade preserves duplicate vocabulary, legacy tables and exact review records without AI', async () => {
  const old = await oldDatabase();
  const word = { ...basicVocabulary('conflict'), id: 'old', status: 'Learning' as const, reviewCount: 8, currentInterval: 7, nextReviewDate: 123456, updatedAt: 555 };
  await old.table('vocabulary').bulkPut([word, { ...word, id: 'duplicate' }]);
  await old.table('readings').put({ id: 'old-passage', topic: '旧文章', content: 'An old passage.', selectedVocabulary: [word], translations: { 'zh-CN': { translatedContent: '旧译文' } } });
  await old.table('reviews').put({ id: 17, vocabularyId: 'old', rating: 'Good', reviewedAt: 45, interval: 7 });
  old.close(); await db.open();
  assert.deepEqual(await db.vocabulary.get('old'), word); assert.equal(await db.vocabulary.count(), 2);
  assert.equal((await db.reviews.get(17))?.reviewedAt, 45); assert.equal(await db.savedMaterials.count(), 0); assert.equal(await db.vocabularyDetails.count(), 0);
  await initDefaultData(); assert.deepEqual(await db.vocabulary.get('old'), word); assert.equal((await db.readings.get('old-passage'))?.content, 'An old passage.');
});
test('failed version upgrade rolls back and the old database remains readable', async () => {
  const old = await oldDatabase(); await old.table('vocabulary').put({ ...basicVocabulary('stable'), id: 'preserved' }); old.close();
  const failing = new EnglishLearningDatabase(); failing.version(3).upgrade(() => { throw new Error('migration interrupted'); });
  await assert.rejects(failing.open(), /migration interrupted/); failing.close();
  const reopened = await oldDatabase(); assert.equal((await reopened.table('vocabulary').get('preserved')).term, 'stable'); reopened.close();
  await db.open(); assert.equal(await db.vocabulary.count(), 1);
});
test('on-demand six-section requests deduplicate, persist, reopen from cache, and preserve review progress', async () => {
  await db.open(); const word = { ...basicVocabulary('conflict'), reviewCount: 9, nextReviewDate: 1234, currentInterval: 7 };
  await db.vocabulary.put(word);
  const incoming = legacyDetails(word); incoming.generated = true; incoming.sections.examples = [{ id: 'e1', text: 'They resolved the conflict.', meaningZh: '他们解决了冲突。' }];
  const realFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify(incoming)); }) as typeof fetch;
  try {
    const [a, b] = await Promise.all([generateVocabularyDetails(word), generateVocabularyDetails(word)]);
    assert.deepEqual(a, b); assert.equal(calls, 1);
    await generateVocabularyDetails(word); assert.equal(calls, 1);
    db.close(); await db.open(); await generateVocabularyDetails(word); assert.equal(calls, 1);
    const saved = (await db.vocabulary.get(word.id))!; assert.equal(saved.reviewCount, 9); assert.equal(saved.nextReviewDate, 1234); assert.equal(saved.currentInterval, 7);
  } finally { globalThis.fetch = realFetch; }
});
test('failed generation never creates a formal word or replaces cached manual content', async () => {
  await db.open(); const word = basicVocabulary('conflict'); const details = legacyDetails(word);
  details.provenance.examples = { source: 'user', updatedAt: 1 }; details.sections.examples = [{ id: 'e', text: 'My example.', meaningZh: '我的例句' }]; await saveVocabularyDetails(details);
  const realFetch = globalThis.fetch; globalThis.fetch = (async () => new Response('{"error":"busy"}', { status: 503 })) as typeof fetch;
  try { await assert.rejects(generateVocabularyDetails(word), /busy/); assert.equal(await db.vocabulary.count(), 0); assert.deepEqual(await db.vocabularyDetails.get(details.key), details); }
  finally { globalThis.fetch = realFetch; }
});
test('independent examples and phrases survive removal, retain stable IDs, and backup/restore together with progress', async () => {
  await db.open(); const word = { ...basicVocabulary('conflict'), reviewCount: 11, currentInterval: 7, nextReviewDate: 4567 }; await db.vocabulary.put(word);
  await toggleMaterial(word, 'examples', { id: 'example1', text: 'A conflict arose.', meaningZh: '发生了冲突。' });
  await toggleMaterial(word, 'examples', { id: 'example2', text: 'Avoid conflict.', meaningZh: '避免冲突。' });
  await toggleMaterial(word, 'phrases', { id: 'phrase1', text: 'conflict of interest', meaningZh: '利益冲突' });
  assert.equal(await db.savedMaterials.count(), 3);
  const backup = await exportMyData(); await deleteVocabulary(word.id);
  assert.equal(await db.savedMaterials.count(), 3); assert.ok((await db.savedMaterials.toArray()).every(item => !item.vocabularyId));
  await importMyData(backup); await importMyData(backup);
  assert.equal(await db.savedMaterials.count(), 3); assert.equal((await db.vocabulary.get(word.id))?.reviewCount, 11);
  const before = await db.vocabulary.toArray();
  await assert.rejects(importMyData(JSON.stringify({ vocabulary: [basicVocabulary('temporary')], readings: [{ id: 'bad' }] })));
  assert.deepEqual(await db.vocabulary.toArray(), before);
});
test('case-sensitive names and abbreviations are not merged', () => {
  assert.notEqual(vocabularyKey('US', 'word'), vocabularyKey('us', 'word'));
  assert.notEqual(vocabularyKey('Polish', 'word'), vocabularyKey('polish', 'word'));
  assert.equal(vocabularyKey('break  the ice ', 'phrase'), vocabularyKey('break the ice', 'idiom'));
});
test('structured families, roots, usage and expression bookmarks survive editing, regeneration and backup restore', async()=>{
  await db.open();const word={...basicVocabulary('helpful'),reviewCount:9,nextReviewDate:87654,currentInterval:14};await db.vocabulary.put(word);
  const detail=legacyDetails(word);detail.generated=true;
  detail.sections.derivatives=[{id:'d',text:'helpfulness',meaningZh:'有用',family:{base:'help',relation:'helpful 加 -ness'}}];
  detail.sections.roots=[{id:'r',text:'help',meaningZh:'帮助',morphology:{root:'help',meaningZh:'帮助',parts:[{kind:'root',text:'help',meaningZh:'帮助'},{kind:'suffix',text:'ful',meaningZh:'具有……性质'}],explanation:'构成有帮助的含义',mnemonic:'联想到帮助别人的人',related:[]}}];
  detail.sections.usage=[{id:'u',text:'语法结构',meaningZh:'可接 to 表示帮助的对象',usageKind:'grammar'}];
  detail.sections.phrases=[{id:'p',text:'be helpful to sb',meaningZh:'对某人有帮助'}];
  await saveVocabularyDetails(detail);await toggleMaterial(word,'phrases',detail.sections.phrases[0]);
  const saved=await exportMyData();await db.delete();await db.open();await importMyData(saved);
  assert.deepEqual((await db.vocabularyDetails.get(detail.key))?.sections,detail.sections);
  const restored=await db.vocabulary.get(word.id);assert.equal(restored?.reviewCount,9);assert.equal(restored?.nextReviewDate,87654);assert.equal(restored?.currentInterval,14);
  assert.equal((await db.savedMaterials.toArray())[0].text,'be helpful to sb');
  const realFetch=globalThis.fetch;globalThis.fetch=(async()=>new Response(JSON.stringify({...detail,sections:{...detail.sections,phrases:[{id:'p2',text:'helpful advice',meaningZh:'有用的建议'}]}}))) as typeof fetch;
  try{await generateVocabularyDetails(word,'phrases',true);assert.equal((await db.savedMaterials.toArray())[0].text,'be helpful to sb');assert.deepEqual((await db.vocabularyDetails.get(detail.key))?.sections.roots,detail.sections.roots);}finally{globalThis.fetch=realFetch;}
});
