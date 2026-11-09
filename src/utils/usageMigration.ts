import type { LearningEntry, VocabularyDetails } from '../types';
import { isChineseUsageExplanation, isLegacyEnglishExplanation } from './usageLanguage.js';
const canonical=(value:string)=>value.toLowerCase().replace(/[^a-z]/g,'');
// Reviewed correction for the exact legacy sentence supplied in the user's report.
// This is not a general-purpose spelling-based translator.
const rootedNotes=new Set([
 'Rooted often implies origin or structural foundation, while ingrained suggests something so deeply fixed (like a habit or belief) that it is hard to remove.',
 'Rooted often implies origin or structural foundation, while ingrained suggests something so deeply fixed that it is hard to remove.',
].map(canonical));
export function usageNeedsRewrite(entry:LearningEntry) {
 if(!entry||typeof entry.text!=='string'||typeof entry.meaningZh!=='string')return false;
 return isLegacyEnglishExplanation(entry.text)||isLegacyEnglishExplanation(entry.meaningZh)||isLegacyEnglishExplanation(typeof entry.note==='string'?entry.note:'')||isLegacyEnglishExplanation(typeof entry.exampleTranslation==='string'?entry.exampleTranslation:'')||(entry.usageChineseVersion!==1&&/词源|语源|拉丁语|历史演变/.test(`${entry.text} ${entry.meaningZh} ${entry.note||''}`));
}
export function reviewedUsageCorrection(term:string,entry:LearningEntry):LearningEntry {
 if(!entry||typeof entry.text!=='string'||typeof entry.meaningZh!=='string')return entry;
 if(term.trim().toLowerCase()!=='rooted'||!rootedNotes.has(canonical(typeof entry.note==='string'?entry.note:'')))return entry;
 const {note:_oldNote,...rest}=entry;
 return {...rest,text:'rooted 与 ingrained 的区别',meaningZh:'rooted 常用 be rooted in …，说明某种感受或观念与什么有关；ingrained 更强调习惯或观念长期形成、很难改变。',usageKind:'comparison',usageChineseVersion:1};
}
export function correctReviewedUsage(details:VocabularyDetails):VocabularyDetails {
 if(details.provenance?.usage?.source!=='ai'||!Array.isArray(details.sections?.usage))return details;
 const usage=details.sections.usage.map(entry=>reviewedUsageCorrection(details.term,entry));
 if(usage.every((entry,index)=>entry===details.sections.usage[index]))return details;
 return {...details,sections:{...details.sections,usage},updatedAt:Date.now()};
}
export interface UsageRewriteJob { id:string; term:string; entry:LearningEntry }
export interface UsageRewriteResult { id:string; text:string; meaningZh:string; note:string; exampleTranslation:string }
export function applyUsageRewrite(entry:LearningEntry,result:UsageRewriteResult):LearningEntry {
 if(!isChineseUsageExplanation(result.text)||!isChineseUsageExplanation(result.meaningZh)|| (result.note&&!isChineseUsageExplanation(result.note)) || (result.exampleTranslation&&!isChineseUsageExplanation(result.exampleTranslation)))throw new Error('旧用法说明的中文改写不完整，原资料已保留。');
 // Preserve English sentences/phrases, corrections, IDs and links. Remove the old
 // explanatory fields completely; no archived English payload is saved.
 const {text:_text,meaningZh:_meaning,note:_note,exampleTranslation:_translation,...rest}=entry;
 const translation=entry.exampleTranslation&&!isLegacyEnglishExplanation(typeof entry.exampleTranslation==='string'?entry.exampleTranslation:'')?entry.exampleTranslation:result.exampleTranslation;
 return {...rest,usageChineseVersion:1,text:result.text,meaningZh:result.meaningZh,...(result.note?{note:result.note}:{}),...(translation?{exampleTranslation:translation}:{})};
}
