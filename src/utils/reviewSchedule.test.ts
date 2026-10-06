import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewIntervalDays } from './reviewSchedule';

test('displayed review intervals preserve the original four-rating schedule', () => {
  assert.equal(reviewIntervalDays('Again', 7), 0);
  assert.equal(reviewIntervalDays('Hard', 7), 1);
  assert.equal(reviewIntervalDays('Good', 0), 3);
  assert.equal(reviewIntervalDays('Good', 7), 10.5);
  assert.equal(reviewIntervalDays('Easy', 0), 7);
  assert.equal(reviewIntervalDays('Easy', 7), 14);
});
