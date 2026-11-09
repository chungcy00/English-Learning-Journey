import assert from 'node:assert/strict';
import { test } from 'node:test';
import { basicVocabulary, legacyDetails, mergeGeneratedDetails } from './vocabularyDetails';
import { cachedParagraphTranslation } from './paragraphTranslation';
import { planReadingDeletion } from './readingVocabularyOwnership';
import type { ReadingRecord } from '../types';
test('full generation retains manual sections and section refresh changes only the requested section', () => {
  const original = legacyDetails(basicVocabulary('conflict'));
  original.sections.examples = [{ id: 'mine', text: 'My edited example.', meaningZh: '我的例句' }];
  original.provenance.examples = { source: 'user', updatedAt: 1 };
  const incoming = structuredClone(original); incoming.sections.examples = [{ id: 'ai', text: 'AI example.', meaningZh: '自动例句' }]; incoming.sections.definitions = [{ id: 'definition', text: 'A disagreement.', meaningZh: '分歧' }];
  const merged = mergeGeneratedDetails(original, incoming); assert.equal(merged.generated, true); assert.deepEqual(merged.sections.examples, original.sections.examples); assert.equal(merged.sections.definitions[0].text, 'A disagreement.');
  const refreshed = mergeGeneratedDetails(merged, incoming, 'examples', true); assert.equal(refreshed.sections.examples[0].text, 'AI example.'); assert.deepEqual(refreshed.sections.definitions, merged.sections.definitions);
});
test('paragraph translation is local, remains grouped, and can reuse unambiguous legacy caches', () => {
  const reading = { paragraphTranslations: [{ source: 'Hello. Welcome!', translation: '你好，欢迎！' }] } as ReadingRecord;
  assert.equal(cachedParagraphTranslation(reading, 'Hello. Welcome!', 0, 1), '你好，欢迎！');
  assert.equal(cachedParagraphTranslation(reading, 'Hello.', 0, 1), undefined);
  const legacy = { readingType: 'story', translations: { 'zh-CN': { sentenceTranslations: [{ source: 'Hello.', translation: '你好。' }, { source: 'Welcome!', translation: '欢迎！' }] } } } as unknown as ReadingRecord;
  assert.equal(cachedParagraphTranslation(legacy, 'Hello. Welcome!', 0, 1), '你好。欢迎！');
});
test('deleting an unrelated passage cannot delete manually added vocabulary with the same spelling', () => {
  const word = basicVocabulary('conflict');
  const plan = planReadingDeletion('r', [word], [{ id: 'r', selectedVocabulary: [{ ...word, id: 'reading-copy' }] }] as ReadingRecord[]);
  assert.deepEqual(plan.removeIds, []);
});

test('partial regeneration retains multi-sense associations without adopting regenerated basic information', () => {
  const current = legacyDetails(basicVocabulary('conflict'));
  current.senses = [{ id: 'noun', text: 'disagreement', meaningZh: '冲突', partOfSpeech: 'noun' }, { id: 'verb', text: 'be incompatible', meaningZh: '相矛盾', partOfSpeech: 'verb' }];
  const incoming = structuredClone(current);
  incoming.senses = current.senses.map(sense => ({ ...sense, id: `new-${sense.id}` }));
  incoming.sections.examples = [{ id: 'example', text: 'Their schedules conflict.', meaningZh: '他们的日程相冲突。', senseId: 'new-verb' }];
  const result = mergeGeneratedDetails(current, incoming, 'examples');
  assert.equal(result.sections.examples[0].senseId, 'verb');
  assert.deepEqual(result.senses, current.senses);
  incoming.sections.examples[0].senseId = 'unrecognized';
  assert.equal(mergeGeneratedDetails(current, incoming, 'examples').sections.examples[0].senseId, '');
});
