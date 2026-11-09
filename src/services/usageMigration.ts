import {db} from '../db/dexie';
import type {VocabularyDetails,VocabularyItem} from '../types';
import {vocabularyKey} from '../utils/vocabularyDetails';
import {correctReviewedUsage,usageNeedsRewrite,applyUsageRewrite,type UsageRewriteJob,type UsageRewriteResult} from '../utils/usageMigration';
const retryKey='mine-usage-rewrite-retry-at';
const notify=()=>window.dispatchEvent(new Event('vocabulary-data-changed'));
const isManual=(details?:VocabularyDetails)=>details?.provenance?.usage?.source==='user';
function records(details:VocabularyDetails[],words:VocabularyItem[]) {
 const all=new Map(details.map(detail=>[detail.key,detail]));
 for(const word of words)if(word.details&&!all.has(word.details.key))all.set(word.details.key,word.details);
 return [...all.values()].filter(detail=>detail&&typeof detail.key==='string'&&typeof detail.term==='string'&&Array.isArray(detail.sections?.usage));
}
function protectedRecord(detail:VocabularyDetails,words:VocabularyItem[]){return isManual(detail)||words.some(word=>vocabularyKey(word.term,word.type)===detail.key&&isManual(word.details));}
async function writeUsage(current:VocabularyDetails,next:VocabularyDetails,words:VocabularyItem[]){
 await db.vocabularyDetails.put(next);
 for(const word of words.filter(word=>vocabularyKey(word.term,word.type)===current.key)){
  const embedded=word.details||current;
  await db.vocabulary.update(word.id,{details:{...embedded,sections:{...embedded.sections,usage:next.sections.usage},provenance:{...embedded.provenance,...(next.provenance.usage?{usage:next.provenance.usage}:{})},updatedAt:next.updatedAt},updatedAt:next.updatedAt});
 }
}
export async function migrateReviewedUsage(){
 let updated=0;
 await db.transaction('rw',db.vocabularyDetails,db.vocabulary,async()=>{
  const [details,words]=await Promise.all([db.vocabularyDetails.toArray(),db.vocabulary.toArray()]);
  for(const current of records(details,words)){
   if(protectedRecord(current,words)){
    if(!isManual(current)){
     const manual=words.filter(word=>vocabularyKey(word.term,word.type)===current.key&&isManual(word.details)).map(word=>word.details!).sort((a,b)=>(b.provenance.usage?.updatedAt||b.updatedAt)-(a.provenance.usage?.updatedAt||a.updatedAt))[0];
     if(manual){await db.vocabularyDetails.put({...current,sections:{...current.sections,usage:manual.sections.usage},provenance:{...current.provenance,usage:manual.provenance.usage},updatedAt:Math.max(current.updatedAt,manual.updatedAt)});updated++;}
    }
    continue;
   }
   if(current.provenance?.usage?.source!=='ai')continue;
   const next=correctReviewedUsage(current);
   if(next!==current){await writeUsage(current,next,words);updated++;}
  }
 });
 if(updated)notify();return updated;
}
export interface UsageMigrationReport {updated:number;pending:number;error?:string}
let pending:Promise<UsageMigrationReport>|undefined;
export function migrateExistingUsage(forceRetry=false):Promise<UsageMigrationReport>{
 if(pending)return pending;
 const work=()=>runMigration(forceRetry);
 pending=(typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request('mine-usage-chinese-migration',work):work()).finally(()=>{pending=undefined;});return pending;
}
async function runMigration(forceRetry:boolean):Promise<UsageMigrationReport>{
 let updated=await migrateReviewedUsage();
 const [details,words]=await Promise.all([db.vocabularyDetails.toArray(),db.vocabulary.toArray()]);
 const snapshots=records(details,words).filter(detail=>detail.provenance?.usage?.source==='ai'&&!protectedRecord(detail,words)&&detail.sections.usage.some(usageNeedsRewrite));
 const jobs:UsageRewriteJob[]=[];const locations=new Map<string,{key:string,index:number}>();
 for(const detail of snapshots)detail.sections.usage.forEach((entry,index)=>{if(usageNeedsRewrite(entry)){const id=crypto.randomUUID();locations.set(id,{key:detail.key,index});jobs.push({id,term:detail.term,entry});}});
 if(!jobs.length)return {updated,pending:0};
 let retryAt=0;try{retryAt=Number(localStorage.getItem(retryKey))||0;}catch{}
 if(!forceRetry&&retryAt>Date.now())return {updated,pending:jobs.length,error:'部分旧 AI 用法说明等待中文更新；上次请求受限，原资料保留，将在可重试后继续。'};
 let completed=0;
 for(let offset=0;offset<jobs.length;){
  const batch:UsageRewriteJob[]=[];
  for(const job of jobs.slice(offset,offset+30)){
   if(batch.length&&new TextEncoder().encode(JSON.stringify({jobs:[...batch,job]})).length>180_000)break;
   batch.push(job);
  }
  try{
   const response=await fetch('/api/vocabulary/explain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'rewrite-existing-usage',jobs:batch}),signal:AbortSignal.timeout(60_000)});
   const data=await response.json();
   if(!response.ok){const delay=Math.max(60,Number(data.retryAfter)||300);try{localStorage.setItem(retryKey,String(Date.now()+delay*1000));}catch{}throw new Error(data.error||'旧 AI 用法说明暂未完成中文更新。');}
   if(!Array.isArray(data.results)||data.results.length!==batch.length)throw new Error('中文更新结果不完整，原资料已保留。');
   const results=new Map<string,UsageRewriteResult>();
   for(const job of batch){const result=data.results.find((item:UsageRewriteResult)=>item.id===job.id);if(!result||results.has(result.id))throw new Error('中文更新结果不完整。');applyUsageRewrite(job.entry,result);results.set(job.id,result);}
   await db.transaction('rw',db.vocabularyDetails,db.vocabulary,async()=>{
    const freshWords=await db.vocabulary.toArray();
    for(const key of new Set(batch.map(job=>locations.get(job.id)!.key))){
     const before=snapshots.find(detail=>detail.key===key)!;
     const current=await db.vocabularyDetails.get(key)||freshWords.find(word=>word.details?.key===key)?.details;
     // Recheck provenance and content in the write transaction. Concurrent edits
     // win; other columns, English examples, saved materials and review data stay.
     if(!current||protectedRecord(current,freshWords)||JSON.stringify(current.sections.usage)!==JSON.stringify(before.sections.usage))continue;
     const replacements=new Map(batch.filter(job=>locations.get(job.id)!.key===key).map(job=>[locations.get(job.id)!.index,results.get(job.id)!]));
     const usage=current.sections.usage.map((entry,index)=>replacements.has(index)?applyUsageRewrite(entry,replacements.get(index)!):entry);
     const next={...current,sections:{...current.sections,usage},updatedAt:Date.now()};await writeUsage(current,next,freshWords);updated++;
     // Later batches for this same word compare against the successfully updated
     // state, without keeping a persistent copy of the deleted English prose.
     before.sections={...before.sections,usage};
    }
   });
   completed+=batch.length;offset+=batch.length;try{localStorage.removeItem(retryKey);}catch{}notify();
  }catch(error){try{if(Number(localStorage.getItem(retryKey))<Date.now())localStorage.setItem(retryKey,String(Date.now()+300_000));}catch{}return {updated,pending:jobs.length-completed,error:error instanceof Error?error.message:'旧用法中文更新失败，原资料已保留。'};}
 }
 const [after,afterWords]=await Promise.all([db.vocabularyDetails.toArray(),db.vocabulary.toArray()]);
 const remaining=records(after,afterWords).filter(detail=>detail.provenance?.usage?.source==='ai'&&!protectedRecord(detail,afterWords)).reduce((count,detail)=>count+detail.sections.usage.filter(usageNeedsRewrite).length,0);
 return {updated,pending:remaining,...(remaining?{error:'部分旧 AI 说明在更新期间发生变化，已保留最新内容，将在下次检查继续。'}:{})};
}
