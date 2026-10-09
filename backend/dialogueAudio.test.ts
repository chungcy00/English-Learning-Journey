import assert from 'node:assert/strict';
import { test } from 'node:test';
import { browserDialogueAudio } from './dialogueAudio';

test('legacy PCM becomes a playable WAV with exact samples and correct lengths', () => {
  const pcm = Buffer.from([0, 0, 255, 127, 0, 128, 255, 255]);
  const wav = browserDialogueAudio(pcm.toString('base64'), 'audio/l16; rate=24000; channels=1');
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt32LE(28), 48000);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), pcm.length);
  assert.deepEqual(wav.subarray(44), pcm);
});

test('defaults to 24kHz; respects returned sample rate and does not double-wrap WAV', () => {
  const data = Buffer.alloc(16).toString('base64');
  assert.equal(browserDialogueAudio(data).readUInt32LE(24), 24000);
  const wav = browserDialogueAudio(data, 'audio/l16', 16000);
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.deepEqual(browserDialogueAudio(wav.toString('base64'), 'audio/wav'), wav);
});

test('rejects empty, unsupported or invalid audio instead of caching unplayable bytes', () => {
  assert.throws(() => browserDialogueAudio(''), /TTS_EMPTY_AUDIO/);
  assert.throws(() => browserDialogueAudio('AA=='), /TTS_INVALID_PCM/);
  assert.throws(() => browserDialogueAudio('AAA=', 'audio/mp3'), /TTS_UNSUPPORTED_AUDIO/);
  assert.throws(() => browserDialogueAudio('AAA=', 'audio/wav'), /TTS_INVALID_WAV/);
  assert.throws(() => browserDialogueAudio('AAA=', 'audio/l16;rate=0'), /TTS_INVALID_PCM/);
});
