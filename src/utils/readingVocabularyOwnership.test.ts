import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ReadingRecord, VocabularyItem } from '../types';
import { planReadingDeletion, vocabularyWithReadingSources } from './readingVocabularyOwnership';
import { planReadingVocabularySync } from './readingVocabulary';

const word = (id: string, term: string, sourceReadingId?: string) => ({id,term,sourceReadingId,status:'Learning',reviewCount:7,nextReviewDate:900,currentInterval:3} as VocabularyItem);
const reading = (id: string, selectedVocabulary: VocabularyItem[]) => ({id,cefrLevel:'B2',selectedVocabulary} as ReadingRecord);

test('history counts only words linked to existing readings, including legacy term copies and manually added expressions', () => {
  const words = [word('sole','courage','a'),word('legacy','nerve','deleted'),word('manual','take a break','deleted'),word('orphan','obsolete','gone'),word('independent','apple')];
  words[2].addedFromReadingIds = ['b'];
  const readings = [reading('a',[]),reading('b',[word('different-id','Nerve')])];
  assert.deepEqual(vocabularyWithReadingSources(words,readings).map(item=>item.id),['sole','legacy','manual']);
  assert.deepEqual(vocabularyWithReadingSources(words,[]),[]);
});

test('deletion removes exclusive bookmarked words and preserves shared IDs, schedules and meanings', () => {
  const exclusive = {...word('exclusive','courage','a'),savedManually:true,wordbookLevels:['B2']} as VocabularyItem;
  const shared = {...word('shared','nerve','a'),meaningZh:'勇气',addedFromReadingIds:['a','missing']};
  const manual = {...word('manual','take a break'),savedManually:true,addedFromReadingIds:['a','b']};
  const readings = [reading('a',[exclusive,shared]),reading('b',[word('copy','Nerve')])];
  const plan = planReadingDeletion('a',[exclusive,shared,manual,word('independent','apple')],readings);
  assert.deepEqual(plan.removeIds,['exclusive']);
  assert.deepEqual(plan.upserts.map(item=>item.id),['shared','manual']);
  assert.equal(plan.upserts[0].sourceReadingId,'b');
  assert.deepEqual(plan.upserts[0].addedFromReadingIds,['b']);
  assert.equal(plan.upserts[0].reviewCount,7); assert.equal(plan.upserts[0].nextReviewDate,900);
  assert.equal(plan.upserts[0].meaningZh,'勇气');
  assert.deepEqual(planReadingDeletion('b',plan.upserts,[readings[1]]).removeIds,['shared','manual']);
});

test('reading saves accumulate source links without replacing review progress or the saved ID', () => {
  const saved = word('saved','nerve','a');
  const newer = reading('b',[word('copy','Nerve','b')]);
  const result = planReadingVocabularySync(undefined,newer,[saved],[reading('a',[])]).upserts[0];
  assert.equal(result.id,'saved'); assert.equal(result.reviewCount,7);
  assert.deepEqual(result.addedFromReadingIds,['a','b']);
});
