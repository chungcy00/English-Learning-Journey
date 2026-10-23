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

test('displayed review delay matches persistence, including fractional day intervals', async () => {
  const { reviewDelayMs, reviewDelayLabel } = await import('./reviewSchedule');
  for (const interval of [0, 1, 7, 15]) {
    for (const rating of ['Again', 'Hard', 'Good', 'Easy'] as const) {
      const days = reviewIntervalDays(rating, interval);
      assert.equal(reviewDelayMs(rating, interval), days === 0 ? 1800000 : days * 86400000);
      assert.equal(reviewDelayLabel(rating, interval), days === 0 ? '30 分钟后' : `${days} 天后`);
    }
  }
});
