import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isChineseUsageExplanation,isLegacyEnglishExplanation} from './usageLanguage';
test('Chinese learning prose permits inline vocabulary and grammar frames, but not appended English essays',()=>{
 assert.ok(isChineseUsageExplanation('常用 be rooted in something，表示某种感受或观念与什么有关。'));
 assert.ok(!isChineseUsageExplanation('Rooted refers to origin and ingrained refers to a persistent habit.'));
 assert.ok(!isChineseUsageExplanation('提示：Rooted often implies origin or structural foundation, while ingrained suggests something so deeply fixed like a habit or belief that it is hard to remove.'));
 assert.ok(!isLegacyEnglishExplanation('rooted vs. ingrained'));
 assert.ok(!isLegacyEnglishExplanation('be rooted in'));
 assert.ok(isLegacyEnglishExplanation('Rooted often implies origin or structural foundation.'));
});
