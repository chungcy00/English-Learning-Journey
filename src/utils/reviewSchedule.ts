import type { ReviewRating } from '../types';

// Keep the displayed delay and the existing persisted schedule identical.
export function reviewIntervalDays(rating: ReviewRating, currentInterval: number) {
  if (rating === 'Again') return 0;
  if (rating === 'Hard') return 1;
  if (rating === 'Good') return currentInterval === 0 ? 3 : Math.max(3, currentInterval * 1.5);
  return currentInterval === 0 ? 7 : Math.max(7, currentInterval * 2);
}
