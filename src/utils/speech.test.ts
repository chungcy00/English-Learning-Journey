import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stopEnglishSpeech } from './speech';

test('stopping paused speech clears its queue and resumes the engine for the next utterance', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const calls: string[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    speechSynthesis: { cancel: () => calls.push('cancel'), resume: () => calls.push('resume') },
  } });
  try {
    stopEnglishSpeech();
    assert.deepEqual(calls, ['cancel', 'resume']);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
