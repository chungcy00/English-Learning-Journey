import 'fake-indexeddb/auto';
import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {db} from './dexie';
import {basicVocabulary,legacyDetails} from '../utils/vocabularyDetails';
import {migrateExistingUsage,migrateReviewedUsage} from '../services/usageMigration';
import type {UsageRewriteJob} from '../utils/usageMigration';
const oldNote='Rooted often implies origin or structural foundation, while ingrained suggests something so deeply fixed (like a habit or belief) that it is hard to remove.';
const originalFetch=globalThis.fetch;
beforeEach(async()=>{const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});await db.delete();await db.open();globalThis.fetch=(async()=>{throw Error('Unexpected network');}) as typeof fetch;});
afterEach(async()=>{await db.delete();globalThis.fetch=originalFetch;Reflect.deleteProperty(globalThis,'window');Reflect.deleteProperty(globalThis,'localStorage');});
async function seed(term='rooted',manual=false,note=oldNote){const word={...basicVocabulary(term),reviewCount:11,nextReviewDate:98765,currentInterval:7};const details=legacyDetails(word);details.generated=true;details.provenance.usage={source:manual?'user':'ai',updatedAt:10};details.sections.usage=[{id:'old',text:'rooted vs. ingrained',meaningZh:'用法辨析',note,example:'Her fear is rooted in an earlier experience.',exampleTranslation:'她的恐惧与过去的一次经历有关。',contrast:{incorrect:'wrong form',correct:'correct form'}}];await db.vocabularyDetails.put(details);await db.vocabulary.put({...word,details});return {word,details};}
const result=(jobs:UsageRewriteJob[])=>({results:jobs.map(job=>({id:job.id,text:'常用表达的区别',meaningZh:'说明这个表达在什么情况下使用，并保留 English words。',note:'',exampleTranslation:''}))});
test('reviewed rooted correction replaces and deletes old AI prose in canonical and embedded caches without an API request',async()=>{
 const {word,details}=await seed();assert.equal(await migrateReviewedUsage(),1);const current=(await db.vocabularyDetails.get(details.key))!;const saved=(await db.vocabulary.get(word.id))!;
 assert.ok(current.sections.usage[0].meaningZh.includes('ingrained 更强调'));assert.equal(current.sections.usage[0].note,undefined);assert.ok(!JSON.stringify(current).includes(oldNote));assert.ok(!JSON.stringify(saved).includes(oldNote));assert.equal(current.sections.usage[0].example,details.sections.usage[0].example);assert.deepEqual(current.sections.usage[0].contrast,details.sections.usage[0].contrast);assert.deepEqual({...current.sections,usage:[]},{...details.sections,usage:[]});assert.equal(saved.reviewCount,11);assert.equal(saved.nextReviewDate,98765);assert.equal(saved.currentInterval,7);assert.equal(await migrateReviewedUsage(),0);
});
test('manual usage is excluded entirely, including a manual embedded copy with stale canonical provenance',async()=>{
 const {word,details}=await seed('rooted',true);assert.deepEqual(await migrateExistingUsage(),{updated:0,pending:0});assert.deepEqual(await db.vocabularyDetails.get(details.key),details);
 await db.vocabularyDetails.put({...details,provenance:{...details.provenance,usage:{source:'ai',updatedAt:1}}});await migrateReviewedUsage();assert.equal((await db.vocabulary.get(word.id))?.details?.sections.usage[0].note,oldNote);
});
test('unknown AI notes batch rewrite while preserving English examples, translations, unrelated columns and review progress',async()=>{
 const {word,details}=await seed('helpful',false,'This old English explanation discusses a word and gives a detailed comparison in English.');let calls=0;
 globalThis.fetch=(async(_url,options)=>{calls++;return new Response(JSON.stringify(result(JSON.parse(String(options?.body)).jobs)));}) as typeof fetch;
 const report=await migrateExistingUsage();assert.equal(report.pending,0);assert.equal(calls,1);const current=(await db.vocabularyDetails.get(details.key))!;
 assert.equal(current.sections.usage[0].note,undefined);assert.ok(!JSON.stringify(current).includes('This old English explanation'));assert.equal(current.sections.usage[0].example,details.sections.usage[0].example);assert.equal(current.sections.usage[0].exampleTranslation,details.sections.usage[0].exampleTranslation);assert.equal((await db.vocabulary.get(word.id))?.reviewCount,11);assert.deepEqual(current.sections.phrases,details.sections.phrases);await migrateExistingUsage();assert.equal(calls,1);
});
test('manual edits made while the rewrite is in flight win over its eventual response',async()=>{
 const {details}=await seed('helpful',false,'This is a long English explanatory paragraph that needs to be converted.');let finish!:(r:Response)=>void;let started!:()=>void;const began=new Promise<void>(r=>{started=r;});let jobs:UsageRewriteJob[]=[];
 globalThis.fetch=(async(_url,options)=>{jobs=JSON.parse(String(options?.body)).jobs;started();return new Promise<Response>(r=>{finish=r;});}) as typeof fetch;
 const operation=migrateExistingUsage();await began;const manual={...details,sections:{...details.sections,usage:[{...details.sections.usage[0],meaningZh:'我的手动内容必须保留'}]},provenance:{...details.provenance,usage:{source:'user' as const,updatedAt:99}}};await db.vocabularyDetails.put(manual);finish(new Response(JSON.stringify(result(jobs))));await operation;assert.deepEqual(await db.vocabularyDetails.get(details.key),manual);
});
test('quota failures retain old data until replacement succeeds and respect the supplied retry delay',async()=>{
 const {details}=await seed('helpful',false,'This English note still needs a Chinese explanation, so it must not be deleted yet.');let calls=0;globalThis.fetch=(async()=>{calls++;return new Response(JSON.stringify({error:'今日额度已用完',retryAfter:3600}),{status:429});}) as typeof fetch;
 const report=await migrateExistingUsage();assert.equal(report.pending,1);assert.equal(report.error,'今日额度已用完');assert.deepEqual(await db.vocabularyDetails.get(details.key),details);await migrateExistingUsage();assert.equal(calls,1);
});

test('unknown provenance is not assumed to be AI and is never silently overwritten',async()=>{
 const {details}=await seed();delete details.provenance.usage;await db.vocabularyDetails.put(details);const all=await db.vocabulary.toArray();await db.vocabulary.update(all[0].id,{details});await migrateExistingUsage();assert.deepEqual(await db.vocabularyDetails.get(details.key),details);
});

test('multiple batches for one word remove all superseded prose without losing earlier batch updates',async()=>{
 const {details}=await seed('helpful',false,'This is another long English explanation to rewrite for the learner.');details.sections.usage=Array.from({length:31},(_,i)=>({...details.sections.usage[0],id:`entry-${i}`}));await db.vocabularyDetails.put(details);const words=await db.vocabulary.toArray();await db.vocabulary.update(words[0].id,{details});let calls=0;
 globalThis.fetch=(async(_url,options)=>{calls++;return new Response(JSON.stringify(result(JSON.parse(String(options?.body)).jobs)));}) as typeof fetch;
 const report=await migrateExistingUsage();assert.equal(report.pending,0);assert.equal(calls,2);const current=(await db.vocabularyDetails.get(details.key))!;assert.equal(current.sections.usage.length,31);assert.ok(current.sections.usage.every(entry=>entry.note===undefined&&entry.meaningZh.includes('使用')));
});

test('a successfully converted point is not repeatedly charged because its Chinese text mentions old terminology',async()=>{
 await seed('helpful',false,'This English history explanation mentions old etymology rather than usage.');let calls=0;globalThis.fetch=(async(_url,options)=>{calls++;const data=result(JSON.parse(String(options?.body)).jobs);data.results[0].meaningZh='请关注 be helpful to 的用法，不需要补充词源背景。';return new Response(JSON.stringify(data));}) as typeof fetch;
 assert.equal((await migrateExistingUsage()).pending,0);await migrateExistingUsage();assert.equal(calls,1);
});
