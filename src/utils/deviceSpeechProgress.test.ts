import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDeviceSpeechProgress, locateDeviceSpeechPosition } from './deviceSpeechProgress';

test('device playback uses seconds from a monotonic clock and excludes preparation, pauses and chunk gaps', () => {
  let now = 100_000;
  const progress = createDeviceSpeechProgress(() => now);
  progress.reset(100);
  now += 5000;
  assert.equal(progress.snapshot().seconds, 0);
  progress.start();
  now += 1200;
  assert.equal(progress.snapshot().seconds, 1.2);
  progress.pause();
  now += 60_000;
  assert.equal(progress.snapshot().seconds, 1.2);
  progress.start();
  progress.start();
  now += 800;
  progress.pause();
  assert.equal(progress.snapshot().seconds, 2);
  progress.reset(100);
  assert.deepEqual(progress.snapshot(), {seconds:0, percent:0});
});

test('confirmed boundaries never jump backward or beyond the text; chunk ends work without boundary events', () => {
  const progress = createDeviceSpeechProgress(() => 0);
  progress.reset(100);
  progress.boundary(0, 20, 40);
  assert.equal(progress.snapshot().percent, 20);
  for (const index of [10, -1, 7000, NaN, Infinity]) progress.boundary(0, index, 40);
  assert.equal(progress.snapshot().percent, 20);
  progress.complete(40);
  assert.equal(progress.snapshot().percent, 40);
  progress.boundary(40, 10, 60);
  assert.equal(progress.snapshot().percent, 50);
  progress.complete(100);
  assert.equal(progress.snapshot().percent, 100);
});

test('seeking locates the right chunk and resumes at a whole word, including start and end positions', () => {
  const chunks = ['Hello world.', 'Good morning.'];
  assert.deepEqual(locateDeviceSpeechPosition(chunks, 0), {queueIndex:0, charIndex:0, characters:0});
  assert.deepEqual(locateDeviceSpeechPosition(chunks, 35), {queueIndex:0, charIndex:6, characters:6});
  assert.deepEqual(locateDeviceSpeechPosition(chunks, 75), {queueIndex:1, charIndex:5, characters:17});
  assert.deepEqual(locateDeviceSpeechPosition(chunks, 100), {queueIndex:2, charIndex:0, characters:25});
  assert.deepEqual(locateDeviceSpeechPosition(chunks, NaN), locateDeviceSpeechPosition(chunks, 0));
  const progress = createDeviceSpeechProgress(() => 0);
  progress.reset(25);
  progress.complete(25);
  progress.seek(6);
  assert.equal(progress.snapshot().percent, 24);
  progress.boundary(6, 5, 6);
  assert.equal(progress.snapshot().percent, 44);
});
