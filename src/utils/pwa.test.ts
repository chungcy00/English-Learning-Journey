import test from 'node:test';
import assert from 'node:assert/strict';
import { manualUpdatePlatform } from './pwa';

test('iPhone and iPad home-screen websites use the web flow, not manual software updates', () => {
  assert.equal(manualUpdatePlatform(true, true, true), false);
  assert.equal(manualUpdatePlatform(false, true, true), false);
  assert.equal(manualUpdatePlatform(true, true, false), true);
  assert.equal(manualUpdatePlatform(false, true, false), false);
  assert.equal(manualUpdatePlatform(true, false, false), false);
});
