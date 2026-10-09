import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dialogueSpeechError } from './dialogueSpeechError';

test('quota failures retain their real message, code and retry window', () => {
  const error = dialogueSpeechError(429, { error: '今日语音额度已用完。', code: 'AI_QUOTA_EXCEEDED' }, '86400');
  assert.equal(error.message, '今日语音额度已用完。');
  assert.equal((error as any).retryAfter, 86400);
  assert.equal((error as any).status, 429);
  assert.equal((error as any).code, 'AI_QUOTA_EXCEEDED');
});

test('configuration and request failures are not labelled as exhausted quota', () => {
  const error = dialogueSpeechError(502, { error: '云端语音请求与服务不兼容，请联系维护者修复。', code: 'TTS_REQUEST_INVALID' }, null);
  assert.match(error.message, /不兼容/);
  assert.equal((error as any).retryAfter, undefined);
  assert.equal((error as any).code, 'TTS_REQUEST_INVALID');
  assert.match(dialogueSpeechError(500, { error: '{provider internals}' }, 'bad').message, /HTTP 500/);
  assert.match(dialogueSpeechError(500, null, null).message, /HTTP 500/);
});

test('speech uses WAV without MP3 bitrate and page visits never retry speech automatically', () => {
  const backend = readFileSync(new URL('../../backend/app.ts', import.meta.url), 'utf8');
  const speech = backend.slice(backend.indexOf('async function generateDialogueAudio'), backend.indexOf('function isDialogueTtsQuotaError'));
  assert.match(speech, /mime_type: 'audio\/wav'/);
  assert.doesNotMatch(speech, /audio\/mp3|bit_rate/);
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../services/api.ts', import.meta.url), 'utf8');
  const reading = readFileSync(new URL('../views/ReadingView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app + api + reading, /refreshPendingDialogueSpeech|queueDialogueSpeechGeminiRetry/);
  assert.doesNotMatch(reading, /Gemini 免费语音额度暂不可用/);
});
