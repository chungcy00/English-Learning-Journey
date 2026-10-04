import type { ReadingStyle } from '../types';

export const READING_STYLES: { value: ReadingStyle; label: string }[] = [
  { value: 'auto', label: 'Auto（自动匹配）' },
  { value: 'natural', label: 'Natural（日常自然）' },
  { value: 'funny', label: 'Funny（轻松搞笑）' },
  { value: 'warm', label: 'Warm（温暖治愈）' },
  { value: 'suspenseful', label: 'Suspenseful（悬疑好奇）' },
  { value: 'dramatic', label: 'Dramatic（戏剧冲突）' },
  { value: 'professional', label: 'Professional（专业正式）' },
  { value: 'cinematic', label: 'Cinematic（电影感）' },
];
