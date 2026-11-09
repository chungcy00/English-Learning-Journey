import {Type} from '@google/genai';
import {applyUsageRewrite,type UsageRewriteJob,type UsageRewriteResult} from '../src/utils/usageMigration.js';
export const usageRewriteSchema={type:Type.ARRAY,items:{type:Type.OBJECT,properties:Object.fromEntries(['id','text','meaningZh','note','exampleTranslation'].map(key=>[key,{type:Type.STRING}])),required:['id','text','meaningZh','note','exampleTranslation']}};
export function parseUsageRewriteJobs(input:unknown):UsageRewriteJob[]{
 if(!Array.isArray(input)||!input.length||input.length>30)throw new Error('一次可更新 1–30 条用法说明。');
 const ids=new Set<string>();
 return input.map(job=>{
  if(!job||typeof job.id!=='string'||job.id.length>160||ids.has(job.id)||typeof job.term!=='string'||job.term.length>160||!job.entry||typeof job.entry.text!=='string'||typeof job.entry.meaningZh!=='string')throw new Error('用法更新资料格式不正确。');
  ids.add(job.id);
  for(const key of ['text','meaningZh','note','example','exampleTranslation'])if(job.entry[key]!==undefined&&(typeof job.entry[key]!=='string'||job.entry[key].length>3000))throw new Error('用法更新内容过长或格式不正确。');
  return {id:job.id,term:job.term,entry:{id:job.id,text:job.entry.text,meaningZh:job.entry.meaningZh,note:job.entry.note||'',example:job.entry.example||'',exampleTranslation:job.entry.exampleTranslation||''}};
 });
}
export function validateUsageRewriteResults(value:unknown,jobs:UsageRewriteJob[]):UsageRewriteResult[]{
 if(!Array.isArray(value)||value.length!==jobs.length)throw new Error('中文用法更新不完整，原资料已保留。');
 const seen=new Set<string>();
 return jobs.map(job=>{
  const result=value.find(item=>item?.id===job.id);
  if(!result||seen.has(result.id)||!['id','text','meaningZh','note','exampleTranslation'].every(key=>typeof result[key]==='string'&&result[key].length<=3000))throw new Error('中文用法更新格式不正确。');
  seen.add(result.id);applyUsageRewrite(job.entry,result);
  return Object.fromEntries(['id','text','meaningZh','note','exampleTranslation'].map(key=>[key,result[key]])) as unknown as UsageRewriteResult;
 });
}
