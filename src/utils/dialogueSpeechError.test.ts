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

test('the reading UI only starts system speech after a user action', () => {
  const reading = readFileSync(new URL('../views/ReadingView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(reading, /await generateDialogueSpeech|await rememberCompletedDialogueSpeech|cloudSpeech/);
  assert.match(reading, /window.speechSynthesis.speak\(utterance\)/);
  assert.match(reading, /selectDialogueVoicePair\(resolvedVoices\)/);
});
