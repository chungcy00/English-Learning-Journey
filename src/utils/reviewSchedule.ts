import type { ReviewRating } from '../types';

// Keep the displayed delay and the existing persisted schedule identical.
export function reviewIntervalDays(rating: ReviewRating, currentInterval: number) {
  if (rating === 'Again') return 0;
  if (rating === 'Hard') return 1;
  if (rating === 'Good') return currentInterval === 0 ? 3 : Math.max(3, currentInterval * 1.5);
  return currentInterval === 0 ? 7 : Math.max(7, currentInterval * 2);
}

export function reviewDelayMs(rating: ReviewRating, currentInterval: number) {
  const days = reviewIntervalDays(rating, currentInterval);
  return days === 0 ? 30 * 60000 : days * 86400000;
}

export function reviewDelayLabel(rating: ReviewRating, currentInterval: number) {
  const delay = reviewDelayMs(rating, currentInterval);
  return delay < 86400000 ? `${delay / 60000} 分钟后` : `${delay / 86400000} 天后`;
}
